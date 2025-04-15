import { Service } from '@n8n/di';
import { Repository, In } from '@n8n/typeorm';
import type { FindOptionsWhere } from '@n8n/typeorm';
import { Logger } from 'n8n-core';

import { WorkflowEntity } from '../databases/entities/workflow-entity';
import { User } from '../databases/entities/user';
import { SharedWorkflow } from '../databases/entities/shared-workflow';
import { SharedWorkflowRepository } from '../databases/repositories/shared-workflow.repository';
import { WorkflowRepository } from '../databases/repositories/workflow.repository';
import { NotFoundError } from '../errors/response-errors/not-found.error';
import { ForbiddenError } from '../errors/response-errors/forbidden.error';
import { ProjectRepository } from '../databases/repositories/project.repository';
import { LlmDescriptionService } from './llm-description.service';

interface PublishWorkflowData {
	name: string;
	description: string;
	category: string;
	workflowId: string;
	isPublic?: boolean;
	useAutoDescription?: boolean;
}

@Service()
export class MarketplaceService {
	private readonly logger: Logger;

	constructor(
		logger: Logger,
		private readonly workflowRepository: WorkflowRepository,
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly projectRepository: ProjectRepository,
		private readonly llmDescriptionService: LlmDescriptionService,
	) {
		this.logger = logger;
		this.logger.info(
			`MarketplaceService instantiated. workflowRepository defined: ${!!this.workflowRepository}`,
		);
		this.logger.info(
			`MarketplaceService instantiated. sharedWorkflowRepository defined: ${!!this.sharedWorkflowRepository}`,
		);
		this.logger.info(
			`MarketplaceService instantiated. projectRepository defined: ${!!this.projectRepository}`,
		);
	}

	/**
	 * Find all published workflows for the marketplace
	 */
	async findAll(user: User): Promise<WorkflowEntity[]> {
		// First, find all workflows that are published and public for everyone
		const publicWorkflows = await this.workflowRepository.find({
			where: {
				marketplaceIsPublic: true,
				isPublished: true,
			},
			order: { updatedAt: 'DESC' },
			select: [
				'id',
				'name',
				'marketplaceDescription',
				'marketplaceCategory',
				'marketplaceDownloads',
				'marketplaceIsPublic',
				'createdAt',
				'updatedAt',
			],
		});

		// Next, find all workflows the user can access that are published
		const userWorkflowsInfo = await this.sharedWorkflowRepository.findAllWorkflowsForUser(user, [
			'workflow:read',
		]);
		const userWorkflowIds = userWorkflowsInfo.map((wf) => wf.id).filter((id) => id != null);

		// If user has no workflows, return just public ones
		if (userWorkflowIds.length === 0) {
			return publicWorkflows;
		}

		// Find the user's published workflows
		const userPublishedWorkflows = await this.workflowRepository.find({
			where: {
				id: In(userWorkflowIds),
				isPublished: true,
			},
			order: { updatedAt: 'DESC' },
			select: [
				'id',
				'name',
				'marketplaceDescription',
				'marketplaceCategory',
				'marketplaceDownloads',
				'marketplaceIsPublic',
				'createdAt',
				'updatedAt',
			],
		});

		// Combine and return unique workflows
		const uniqueWorkflows = new Map();

		// Add public workflows
		publicWorkflows.forEach((workflow) => {
			uniqueWorkflows.set(workflow.id, workflow);
		});

		// Add user's workflows, potentially overriding public ones if they're the same
		userPublishedWorkflows.forEach((workflow) => {
			uniqueWorkflows.set(workflow.id, workflow);
		});

		return Array.from(uniqueWorkflows.values());
	}

	/**
	 * Publish a workflow to the marketplace
	 */
	async publish(user: User, data: PublishWorkflowData): Promise<WorkflowEntity> {
		// Use findWorkflowForUser to check read access
		const workflow = await this.sharedWorkflowRepository.findWorkflowForUser(
			data.workflowId,
			user,
			['workflow:read', 'workflow:update'],
		);

		if (!workflow) {
			throw new ForbiddenError('Permission denied or workflow not found');
		}

		try {
			// If user opted for auto-description, generate it using LLM
			let description = data.description;
			if (data.useAutoDescription) {
				const generatedDescription =
					await this.llmDescriptionService.generateWorkflowDescription(workflow);
				if (generatedDescription) {
					description = generatedDescription;
					this.logger.debug('Generated workflow description using LLM', {
						workflowId: workflow.id,
						description: generatedDescription,
					});
				}
			}

			// Only update the specific marketplace fields instead of the entire workflow object
			// This prevents circular reference issues during JSON serialization
			const updatedWorkflow = await this.workflowRepository.update(
				{ id: workflow.id },
				{
					isPublished: true,
					marketplaceDescription: description,
					marketplaceCategory: data.category,
					marketplaceIsPublic: data.isPublic ?? true,
				},
			);

			// Fetch the updated workflow to return
			return await this.workflowRepository.findOneByOrFail({ id: workflow.id });
		} catch (error) {
			this.logger.error(`Error publishing workflow ${data.workflowId}: ${error.message}`, {
				userId: user.id,
				workflowId: data.workflowId,
			});
			throw new Error(`Failed to publish workflow: ${error.message}`);
		}
	}

	/**
	 * Import a workflow from the marketplace
	 */
	async import(user: User, workflowId: string): Promise<WorkflowEntity> {
		// Validate the input workflowId to ensure it's a valid string
		if (!workflowId || typeof workflowId !== 'string') {
			this.logger.error(`Invalid workflow ID provided for import: ${typeof workflowId}`, {
				userId: user.id,
			});
			throw new Error('Invalid workflow ID format provided');
		}

		try {
			// Find the original workflow with only necessary fields
			const sourceWorkflow = await this.workflowRepository.findOne({
				where: {
					id: workflowId,
					isPublished: true,
					marketplaceIsPublic: true,
				},
				select: ['id', 'name', 'nodes', 'connections', 'settings', 'staticData'],
			});

			if (!sourceWorkflow) {
				throw new NotFoundError('Published workflow not found');
			}

			// Create a new workflow entity
			const newWorkflow = new WorkflowEntity();

			// Create a deep copy using JSON serialization with circular reference handling
			// This ensures we break any circular references in the source workflow data
			const safeNodes = this.safeClone(sourceWorkflow.nodes);
			const safeConnections = this.safeClone(sourceWorkflow.connections);
			const safeSettings = sourceWorkflow.settings
				? this.safeClone(sourceWorkflow.settings)
				: undefined;
			const safeStaticData = sourceWorkflow.staticData
				? this.safeClone(sourceWorkflow.staticData)
				: undefined;

			// Only copy essential properties with safe clones
			newWorkflow.name = `${sourceWorkflow.name} (Imported)`;
			newWorkflow.nodes = safeNodes;
			newWorkflow.connections = safeConnections;
			newWorkflow.settings = safeSettings;
			newWorkflow.staticData = safeStaticData;
			newWorkflow.active = false;
			newWorkflow.versionId = crypto.randomUUID();

			// Get the user's personal project
			const personalProject = await this.projectRepository.getPersonalProjectForUserOrFail(user.id);

			// Handle within a transaction
			const savedWorkflow = await this.workflowRepository.manager.transaction(
				async (transactionManager) => {
					// Save the new workflow
					const savedWf = await transactionManager.save(newWorkflow);

					// Create the sharing relationship
					const newSharing = new SharedWorkflow();
					newSharing.workflowId = savedWf.id;
					newSharing.projectId = personalProject.id;
					newSharing.role = 'workflow:owner';
					await transactionManager.save(newSharing);

					// Increment download count for the source workflow
					await transactionManager.increment(
						WorkflowEntity,
						{ id: workflowId },
						'marketplaceDownloads',
						1,
					);

					// Return a clean workflow object
					return await transactionManager.findOne(WorkflowEntity, {
						where: { id: savedWf.id },
						select: ['id', 'name', 'active', 'createdAt', 'updatedAt'],
					});
				},
			);

			// Return the successfully imported workflow
			return savedWorkflow as WorkflowEntity;
		} catch (error) {
			// Log more detailed information about the error
			this.logger.error(`Error importing workflow ${workflowId}: ${error.message}`, {
				userId: user.id,
				workflowId,
				errorName: error.name,
				errorStack: error.stack,
			});

			// Handle different types of errors more specifically
			if (error instanceof NotFoundError) {
				throw error; // Pass through not found errors
			} else if (error.message.includes('circular')) {
				throw new Error(
					'Failed to import workflow: The workflow contains circular references that cannot be processed.',
				);
			} else {
				throw new Error(`Failed to import workflow: ${error.message}`);
			}
		}
	}

	/**
	 * Helper method to safely clone objects without circular references
	 * This breaks circular references by using a replacer function in JSON.stringify
	 */
	private safeClone<T>(obj: T): T {
		if (!obj) return obj;

		// Use a WeakSet to track objects that have been seen
		const seen = new WeakSet();

		// Custom replacer function to handle circular references
		const replacer = (key: string, value: any) => {
			// Skip non-object values and null
			if (typeof value !== 'object' || value === null) {
				return value;
			}

			// Specifically handle HTTP-related objects that commonly cause circular references
			if (
				// HTTP-related objects
				value.constructor?.name === 'Socket' ||
				value.constructor?.name === 'HTTPParser' ||
				value.constructor?.name === 'IncomingMessage' ||
				value.constructor?.name === 'ServerResponse' ||
				value.constructor?.name === 'ClientRequest' ||
				// Node.js internal objects
				value.constructor?.name === 'Server' ||
				// Check for specific properties that indicate request/response objects
				value.req ||
				value.res ||
				value._httpMessage ||
				value.socket
			) {
				// Replace these objects with a placeholder to break the circular reference
				return {
					_type: value.constructor?.name || 'ServerObject',
					_placeholder: true,
					_isNonSerializable: true,
				};
			}

			// Check if we've seen this object before
			if (seen.has(value)) {
				// Return a simplified reference to avoid circular references
				return { _circular: true };
			}

			// Add the object to our tracking set
			seen.add(value);

			// Return the value for further processing
			return value;
		};

		try {
			// Stringify and re-parse to create a deep clone without circular references
			return JSON.parse(JSON.stringify(obj, replacer));
		} catch (error) {
			// If JSON.stringify still fails, fall back to a more aggressive approach
			this.logger.warn(`Failed to clone object safely with replacer: ${error.message}`);

			// Create a minimal copy with only essential data
			return this.createMinimalCopy(obj);
		}
	}

	/**
	 * Fallback method to create a minimal copy of an object
	 * Used when the standard safeClone method fails
	 */
	private createMinimalCopy<T>(obj: T): T {
		if (!obj || typeof obj !== 'object') {
			return obj;
		}

		// For arrays, map each element and process it
		if (Array.isArray(obj)) {
			return obj.map((item) => this.createMinimalCopy(item)) as unknown as T;
		}

		// For objects, create a new object with minimal properties
		const safeCopy: any = {};

		// Copy only primitive values and simple objects
		for (const [key, value] of Object.entries(obj)) {
			if (value === null || value === undefined) {
				safeCopy[key] = value;
			} else if (typeof value !== 'object') {
				// Primitive values are safe to copy directly
				safeCopy[key] = value;
			} else if (Array.isArray(value)) {
				// Process arrays recursively
				safeCopy[key] = this.createMinimalCopy(value);
			} else if (Object.prototype.toString.call(value) === '[object Object]') {
				// Regular objects need to be processed recursively, but skip complex objects
				const constructor = value.constructor?.name;
				if (constructor === 'Object') {
					safeCopy[key] = this.createMinimalCopy(value);
				} else {
					// For complex objects, store a placeholder
					safeCopy[key] = { _type: constructor, _placeholder: true };
				}
			} else {
				// For any other types, just use a placeholder
				safeCopy[key] = { _type: typeof value, _placeholder: true };
			}
		}

		return safeCopy as T;
	}

	/**
	 * Find user's workflows for publishing
	 */
	async findUserWorkflows(user: User): Promise<WorkflowEntity[]> {
		// Find workflows the user can publish
		const workflowInfos = await this.sharedWorkflowRepository.findAllWorkflowsForUser(user, [
			'workflow:read',
			'workflow:update',
		]);

		if (!workflowInfos || workflowInfos.length === 0) {
			return [];
		}

		// Extract workflow IDs
		const workflowIds = workflowInfos.map((wf) => wf.id).filter((id) => id != null);

		if (workflowIds.length === 0) {
			return [];
		}

		// Fetch workflow details with only necessary fields to avoid circular references
		return await this.workflowRepository.find({
			where: { id: In(workflowIds) },
			select: ['id', 'name', 'active', 'createdAt', 'updatedAt'],
		});
	}

	/**
	 * Generate a preview of the automatic description for a workflow
	 */
	async generateDescriptionPreview(user: User, workflowId: string): Promise<string> {
		// Check read access to the workflow
		const workflow = await this.sharedWorkflowRepository.findWorkflowForUser(workflowId, user, [
			'workflow:read',
		]);

		if (!workflow) {
			throw new ForbiddenError('Permission denied or workflow not found');
		}

		try {
			// Generate description using LLM
			const generatedDescription =
				await this.llmDescriptionService.generateWorkflowDescription(workflow);

			if (!generatedDescription) {
				return 'Unable to generate a description. Please provide one manually.';
			}

			return generatedDescription;
		} catch (error) {
			this.logger.error(
				`Error generating preview description for workflow ${workflowId}: ${error.message}`,
				{
					userId: user.id,
					workflowId,
				},
			);
			throw new Error(`Failed to generate description preview: ${error.message}`);
		}
	}
}
