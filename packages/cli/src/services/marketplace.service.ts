import { Service } from '@n8n/di';
import { Repository, In } from '@n8n/typeorm';
import type { FindOptionsWhere } from '@n8n/typeorm';
import { Logger } from 'n8n-core';

import { MarketplaceWorkflowEntity } from '../databases/entities/marketplace-workflow-entity';
import { WorkflowEntity } from '../databases/entities/workflow-entity';
import { User } from '../databases/entities/user';
import { SharedWorkflow } from '../databases/entities/shared-workflow';
import { SharedWorkflowRepository } from '../databases/repositories/shared-workflow.repository';
import { MarketplaceWorkflowRepository } from '../databases/repositories/marketplace-workflow.repository';
import { WorkflowRepository } from '../databases/repositories/workflow.repository';
import { NotFoundError } from '../errors/response-errors/not-found.error';
import { ForbiddenError } from '../errors/response-errors/forbidden.error';
import { ProjectRepository } from '../databases/repositories/project.repository';

interface StoredWorkflowData {
	nodes: any[]; // Use any[] for simplicity if INode causes issues
	connections: any; // Use any for simplicity if IConnections causes issues
	settings?: any;
	staticData?: any;
}

interface PublishWorkflowData {
	name: string;
	description: string;
	category: string;
	workflowId: string;
	isPublic?: boolean;
}

@Service()
export class MarketplaceService {
	private readonly logger: Logger;

	constructor(
		logger: Logger,
		private readonly marketplaceRepository: MarketplaceWorkflowRepository,
		private readonly workflowRepository: WorkflowRepository,
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly projectRepository: ProjectRepository,
	) {
		this.logger = logger;
		this.logger.info(
			`MarketplaceService instantiated. marketplaceRepository defined: ${!!this.marketplaceRepository}`,
		);
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

	async findAll(user: User): Promise<MarketplaceWorkflowEntity[]> {
		return await this.marketplaceRepository.find({
			where: [{ isPublic: true }, { createdByUserId: user.id }],
			order: { createdAt: 'DESC' },
		});
	}

	async publish(user: User, data: PublishWorkflowData): Promise<MarketplaceWorkflowEntity> {
		// Use findWorkflowForUser to check read access - adjust scopes if specific role needed
		const workflow = await this.sharedWorkflowRepository.findWorkflowForUser(
			data.workflowId,
			user,
			['workflow:read'],
		);

		if (!workflow) {
			throw new ForbiddenError('Permission denied or workflow not found');
		}

		const workflowJson: StoredWorkflowData = {
			nodes: workflow.nodes,
			connections: workflow.connections,
			settings: workflow.settings,
			staticData: workflow.staticData,
		};

		let existingEntry = await this.marketplaceRepository.findOneBy({
			originalWorkflowId: data.workflowId,
			createdByUserId: user.id,
		});

		if (existingEntry) {
			existingEntry.name = data.name;
			existingEntry.description = data.description;
			existingEntry.category = data.category;
			existingEntry.workflowJson = workflowJson;
			existingEntry.isPublic = data.isPublic ?? existingEntry.isPublic;
			return await this.marketplaceRepository.save(existingEntry);
		} else {
			const newMarketplaceEntry = this.marketplaceRepository.create({
				name: data.name,
				description: data.description,
				category: data.category,
				authorId: user.id,
				authorName: user.email,
				workflowJson: workflowJson,
				isPublic: data.isPublic ?? true,
				originalWorkflowId: data.workflowId,
				createdByUserId: user.id,
			});
			return await this.marketplaceRepository.save(newMarketplaceEntry);
		}
	}

	async import(user: User, marketplaceWorkflowId: string): Promise<WorkflowEntity> {
		const marketplaceWorkflow = await this.marketplaceRepository.findOneBy({
			id: marketplaceWorkflowId,
		});
		if (!marketplaceWorkflow) {
			throw new NotFoundError('Marketplace workflow not found');
		}

		if (!marketplaceWorkflow.isPublic && marketplaceWorkflow.authorId !== user.id) {
			throw new ForbiddenError('Cannot import this workflow');
		}

		const { nodes, connections, settings, staticData } = marketplaceWorkflow.workflowJson;

		// Get the user's personal project to assign the imported workflow
		const personalProject = await this.projectRepository.getPersonalProjectForUserOrFail(user.id);

		const newWorkflowData = {
			name: `${marketplaceWorkflow.name} (Imported)`,
			nodes: nodes,
			connections: connections,
			settings: settings,
			staticData: staticData,
			active: false,
			// versionId is required by WorkflowEntity
			versionId: crypto.randomUUID(), // Generate a new version ID
		};

		// Use transaction to ensure workflow and sharing are created together
		return await this.workflowRepository.manager.transaction(async (transactionalEntityManager) => {
			const workflowRepo = transactionalEntityManager.getRepository(WorkflowEntity);
			const sharedRepo = transactionalEntityManager.getRepository(SharedWorkflow);

			const savedWorkflow = await workflowRepo.save(newWorkflowData);

			const newSharing = sharedRepo.create({
				workflowId: savedWorkflow.id,
				projectId: personalProject.id,
				role: 'workflow:owner',
			});
			await sharedRepo.save(newSharing);

			// Increment downloads only if not the author
			if (marketplaceWorkflow.authorId !== user.id) {
				await this.marketplaceRepository.increment({ id: marketplaceWorkflowId }, 'downloads', 1);
			}

			return savedWorkflow;
		});
	}

	async findUserWorkflows(user: User): Promise<WorkflowEntity[]> {
		// Request read scope to find workflows user can see
		const workflowInfos = await this.sharedWorkflowRepository.findAllWorkflowsForUser(user, [
			'workflow:read',
		]);

		if (!workflowInfos || workflowInfos.length === 0) {
			return [];
		}

		// Extract the workflow IDs from the returned objects
		const workflowIds = workflowInfos.map((wf) => wf.id).filter((id) => id != null);

		if (workflowIds.length === 0) {
			return [];
		}

		// Fetch the full WorkflowEntity instances using the IDs
		return await this.workflowRepository.findBy({ id: In(workflowIds) });
	}
}
