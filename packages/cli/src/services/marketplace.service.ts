import { Service } from '@n8n/di';
import { Repository, In } from '@n8n/typeorm';
import type { FindOptionsWhere } from '@n8n/typeorm';
import { Logger } from 'n8n-core';

import { WorkflowEntity } from '../databases/entities/workflow-entity';
import { MarketplaceWorkflowEntity } from '../databases/entities/marketplace-workflow-entity';
import { User } from '../databases/entities/user';
import { SharedWorkflow } from '../databases/entities/shared-workflow';
import { SharedWorkflowRepository } from '../databases/repositories/shared-workflow.repository';
import { WorkflowRepository } from '../databases/repositories/workflow.repository';
import { MarketplaceWorkflowRepository } from '../databases/repositories/marketplace-workflow.repository';
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
		private readonly marketplaceWorkflowRepository: MarketplaceWorkflowRepository,
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly projectRepository: ProjectRepository,
		private readonly llmDescriptionService: LlmDescriptionService,
	) {
		this.logger = logger;
		this.logger.info(
			`MarketplaceService instantiated. workflowRepository defined: ${!!this.workflowRepository}`,
		);
		this.logger.info(
			`MarketplaceService instantiated. marketplaceWorkflowRepository defined: ${!!this.marketplaceWorkflowRepository}`,
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
	async findAll(user: User): Promise<MarketplaceWorkflowEntity[]> {
		// First, find all public marketplace workflows
		const publicWorkflows = await this.marketplaceWorkflowRepository.find({
			where: {
				isPublic: true,
			},
			order: { updatedAt: 'DESC' },
		});

		// Next, find all workflows the user has authored
		const userPublishedWorkflows = await this.marketplaceWorkflowRepository.find({
			where: {
				authorId: user.id,
			},
			order: { updatedAt: 'DESC' },
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
	async publish(user: User, data: PublishWorkflowData): Promise<MarketplaceWorkflowEntity> {
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

			// Check if this workflow has already been published to marketplace
			let marketplaceWorkflow = await this.marketplaceWorkflowRepository.findOne({
				where: { originalWorkflowId: workflow.id },
			});

			// If it doesn't exist, create a new marketplace workflow entry
			if (!marketplaceWorkflow) {
				marketplaceWorkflow = new MarketplaceWorkflowEntity();
				marketplaceWorkflow.originalWorkflowId = workflow.id;
				marketplaceWorkflow.createdByUserId = user.id;
			}

			// Update the marketplace workflow data
			marketplaceWorkflow.name = data.name;
			marketplaceWorkflow.description = description;
			marketplaceWorkflow.category = data.category;
			marketplaceWorkflow.authorId = user.id;
			marketplaceWorkflow.authorName =
				user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
			marketplaceWorkflow.isPublic = data.isPublic ?? true;
			marketplaceWorkflow.workflowJson = {
				nodes: workflow.nodes,
				connections: workflow.connections,
				settings: workflow.settings,
				staticData: workflow.staticData,
			};

			// Save the marketplace workflow
			const savedWorkflow = await this.marketplaceWorkflowRepository.save(marketplaceWorkflow);

			return savedWorkflow;
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
	async import(
		user: User,
		workflowId: string,
	): Promise<{ workflow: WorkflowEntity; marketplaceWorkflow: MarketplaceWorkflowEntity }> {
		// Validate the input workflowId to ensure it's a valid string
		if (!workflowId || typeof workflowId !== 'string') {
			this.logger.error(`Invalid workflow ID provided for import: ${typeof workflowId}`, {
				userId: user.id,
			});
			throw new Error('Invalid workflow ID format provided');
		}

		try {
			// Find the original marketplace workflow
			const marketplaceWorkflow = await this.marketplaceWorkflowRepository.findOne({
				where: {
					id: workflowId,
					isPublic: true,
				},
			});

			if (!marketplaceWorkflow) {
				throw new NotFoundError('Published workflow not found');
			}

			// Create a new workflow entity
			const newWorkflow = new WorkflowEntity();

			// Create a deep copy using JSON serialization with circular reference handling
			const safeNodes = this.safeClone(marketplaceWorkflow.workflowJson.nodes);
			const safeConnections = this.safeClone(marketplaceWorkflow.workflowJson.connections);
			const safeSettings = marketplaceWorkflow.workflowJson.settings
				? this.safeClone(marketplaceWorkflow.workflowJson.settings)
				: undefined;
			const safeStaticData = marketplaceWorkflow.workflowJson.staticData
				? this.safeClone(marketplaceWorkflow.workflowJson.staticData)
				: undefined;

			// Copy essential properties with safe clones
			newWorkflow.name = `${marketplaceWorkflow.name} (Imported)`;
			newWorkflow.nodes = safeNodes;
			newWorkflow.connections = safeConnections;
			newWorkflow.settings = safeSettings;
			newWorkflow.staticData = safeStaticData;
			newWorkflow.active = false;
			newWorkflow.versionId = crypto.randomUUID();

			// Get the user's personal project
			const personalProject = await this.projectRepository.getPersonalProjectForUserOrFail(user.id);

			// Handle within a transaction
			const savedResult = await this.workflowRepository.manager.transaction(
				async (transactionManager) => {
					// Save the new workflow
					const savedWf = await transactionManager.save(newWorkflow);

					// Create the sharing relationship
					const newSharing = new SharedWorkflow();
					newSharing.workflowId = savedWf.id;
					newSharing.projectId = personalProject.id;
					newSharing.role = 'workflow:owner';
					await transactionManager.save(newSharing);

					// Increment download count for the marketplace workflow
					await transactionManager.increment(
						MarketplaceWorkflowEntity,
						{ id: workflowId },
						'downloads',
						1,
					);

					// Get the clean workflow object
					const cleanWorkflow = await transactionManager.findOne(WorkflowEntity, {
						where: { id: savedWf.id },
						select: ['id', 'name', 'active', 'createdAt', 'updatedAt'],
					});

					// Get the updated marketplace workflow
					const updatedMarketplaceWorkflow = await transactionManager.findOne(
						MarketplaceWorkflowEntity,
						{
							where: { id: workflowId },
						},
					);

					return {
						workflow: cleanWorkflow,
						marketplaceWorkflow: updatedMarketplaceWorkflow,
					};
				},
			);

			// Return the successfully imported workflow and updated marketplace workflow
			return {
				workflow: savedResult.workflow as WorkflowEntity,
				marketplaceWorkflow: savedResult.marketplaceWorkflow as MarketplaceWorkflowEntity,
			};
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
					'Failed to import workflow due to circular references in the data structure. Please try again or contact support.',
				);
			} else {
				throw new Error(`Failed to import workflow: ${error.message}`);
			}
		}
	}

	/**
	 * Safe deep clone with circular reference handling
	 */
	private safeClone<T>(obj: T): T {
		if (!obj) return obj;

		try {
			// Use a more memory-efficient approach for large objects
			// Instead of using JSON.stringify/parse for the entire object at once
			// Process the object in a more controlled way

			// For arrays, process each item individually
			if (Array.isArray(obj)) {
				return obj.map((item) => this.cloneItem(item)) as unknown as T;
			}

			// For objects, create a new object and copy properties
			if (typeof obj === 'object') {
				const result: Record<string, any> = {};
				for (const key in obj) {
					if (Object.prototype.hasOwnProperty.call(obj, key)) {
						result[key] = this.cloneItem((obj as Record<string, any>)[key]);
					}
				}
				return result as T;
			}

			// For primitive values, return as is
			return obj;
		} catch (error) {
			console.error('Error in safeClone:', error);
			// If deep clone fails, create a shallow copy
			return this.createMinimalCopy(obj);
		}
	}

	/**
	 * Helper method to clone individual items within an object
	 */
	private cloneItem(value: any): any {
		// Handle null values
		if (value === null) return null;

		// Handle primitive values
		if (typeof value !== 'object' && typeof value !== 'function') {
			return value;
		}

		// Handle functions
		if (typeof value === 'function') {
			return `[Function: ${value.name || 'anonymous'}]`;
		}

		// Handle dates
		if (value instanceof Date) {
			return new Date(value.getTime());
		}

		// Handle arrays
		if (Array.isArray(value)) {
			// For large arrays, consider slicing if needed
			if (value.length > 10000) {
				this.logger.warn(
					'Large array detected in workflow clone operation, performance may be affected',
				);
			}
			return value.map((item) => this.cloneItem(item));
		}

		// Handle special case for parameters that might cause circular references
		if (value && typeof value === 'object') {
			// Check if this is a parameters object which needs special handling
			if ('parameters' in value && typeof value.parameters === 'object') {
				const result: Record<string, any> = {};

				for (const key in value) {
					if (key === 'parameters') {
						// Special handling for parameters
						result[key] = this.handleParameters(value[key]);
					} else {
						// Normal cloning for other properties
						result[key] = this.cloneItem(value[key]);
					}
				}

				return result;
			}

			// Regular object cloning
			const result: Record<string, any> = {};
			for (const key in value) {
				if (Object.prototype.hasOwnProperty.call(value, key)) {
					result[key] = this.cloneItem(value[key]);
				}
			}
			return result;
		}

		// Fallback - return empty object
		return {};
	}

	/**
	 * Special handler for parameters to avoid circular references
	 */
	private handleParameters(parameters: any): any {
		if (!parameters || typeof parameters !== 'object') {
			return parameters;
		}

		const cleanedParams: Record<string, any> = {};

		for (const key in parameters) {
			if (Object.prototype.hasOwnProperty.call(parameters, key)) {
				const value = parameters[key];

				// Keep primitive values as is
				if (value === null || typeof value !== 'object') {
					cleanedParams[key] = value;
					continue;
				}

				// For arrays, make a shallow copy
				if (Array.isArray(value)) {
					cleanedParams[key] = [...value];
					continue;
				}

				// For objects, make a shallow copy
				cleanedParams[key] = { ...value };
			}
		}

		return cleanedParams;
	}

	/**
	 * Creates a minimal copy of an object when full cloning fails
	 */
	private createMinimalCopy<T>(obj: T): T {
		if (!obj) return obj;

		try {
			if (Array.isArray(obj)) {
				// For arrays, create a new array with shallow copies of objects
				return obj.map((item) => {
					if (item && typeof item === 'object') {
						const copy: any = {};
						// Copy only immediate properties
						for (const key in item) {
							if (Object.prototype.hasOwnProperty.call(item, key)) {
								const value = (item as any)[key];
								// Only use primitive values and simple objects
								if (
									value === null ||
									typeof value !== 'object' ||
									(Array.isArray(value) && value.length === 0) ||
									Object.keys(value).length === 0
								) {
									copy[key] = value;
								} else {
									// For complex nested objects, store a placeholder
									copy[key] = typeof value;
								}
							}
						}
						return copy;
					}
					return item;
				}) as unknown as T;
			} else if (obj && typeof obj === 'object') {
				// For objects, create a shallow copy with basic properties
				const copy: any = {};
				for (const key in obj) {
					if (Object.prototype.hasOwnProperty.call(obj, key)) {
						copy[key] = (obj as any)[key];
					}
				}
				return copy as T;
			}

			// For primitive values
			return obj;
		} catch (error) {
			console.error('Error in createMinimalCopy:', error);
			// If all else fails, return an empty object of the same type
			return Array.isArray(obj) ? ([] as unknown as T) : ({} as T);
		}
	}

	/**
	 * Find all workflows that the user can publish
	 */
	async findUserWorkflows(user: User): Promise<WorkflowEntity[]> {
		// Find all workflows the user has access to
		const userWorkflowsInfo = await this.sharedWorkflowRepository.findAllWorkflowsForUser(user, [
			'workflow:read',
			'workflow:update', // User needs update permission to publish
		]);

		const userWorkflowIds = userWorkflowsInfo.map((wf) => wf.id).filter((id) => id != null);

		// If user has no workflows, return empty array
		if (userWorkflowIds.length === 0) {
			return [];
		}

		// Find the user's workflows with minimal fields
		return await this.workflowRepository.find({
			where: {
				id: In(userWorkflowIds),
			},
			order: { updatedAt: 'DESC' },
			select: ['id', 'name', 'active', 'createdAt', 'updatedAt'],
		});
	}

	/**
	 * Generate a preview of the auto-generated description
	 */
	async generateDescriptionPreview(user: User, workflowId: string): Promise<string> {
		// First, get the workflow with read access check
		const workflow = await this.sharedWorkflowRepository.findWorkflowForUser(workflowId, user, [
			'workflow:read',
		]);

		if (!workflow) {
			throw new ForbiddenError('Permission denied or workflow not found');
		}

		try {
			// Generate a description using the LLM service
			const description = await this.llmDescriptionService.generateWorkflowDescription(workflow);
			return description || 'Unable to generate description automatically';
		} catch (error) {
			this.logger.error(`Error generating preview description: ${error.message}`, {
				workflowId,
				userId: user.id,
			});
			return 'Error generating description. Please provide one manually.';
		}
	}

	/**
	 * Delete a workflow from the marketplace
	 * Only admins or the original author can delete a workflow
	 */
	async delete(user: User, workflowId: string): Promise<boolean> {
		try {
			// Find the marketplace workflow
			const marketplaceWorkflow = await this.marketplaceWorkflowRepository.findOne({
				where: { id: workflowId },
			});

			if (!marketplaceWorkflow) {
				throw new NotFoundError('Marketplace workflow not found');
			}

			// Check if user is authorized to delete (must be admin or the original author)
			const isAdmin = user.role === 'global:admin' || user.role === 'global:owner';
			const isAuthor = marketplaceWorkflow.authorId === user.id;

			if (!isAdmin && !isAuthor) {
				throw new ForbiddenError('You do not have permission to delete this workflow');
			}

			// Delete the workflow
			await this.marketplaceWorkflowRepository.delete(workflowId);

			this.logger.info(`Workflow ${workflowId} deleted from marketplace`, {
				userId: user.id,
				workflowId,
				isAdmin,
				isAuthor,
			});

			return true;
		} catch (error) {
			this.logger.error(`Error deleting marketplace workflow ${workflowId}: ${error.message}`, {
				userId: user.id,
				workflowId,
			});
			throw error;
		}
	}
}
