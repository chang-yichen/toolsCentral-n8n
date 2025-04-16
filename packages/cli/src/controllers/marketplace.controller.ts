import { Get, Post, RestController, Param } from '@/decorators';
import { MarketplaceService } from '@/services/marketplace.service'; // Use alias path
import type { Request as ExpressRequest } from 'express'; // Use Express types if applicable
import type { User } from '../databases/entities/user'; // Assuming User entity path
import { BadRequestError } from '../errors/response-errors/bad-request.error';
import type { MarketplaceWorkflowEntity } from '../databases/entities/marketplace-workflow-entity';

interface AuthenticatedRequest extends ExpressRequest {
	user: User; // Use the actual User type
	body: any;
}

// Define the expected structure for clarity, though we access req.body directly
interface PublishWorkflowDto {
	name: string;
	description: string;
	category: string;
	workflowId: string;
	isPublic?: boolean;
	useAutoDescription?: boolean;
}

// Interface for a clean workflow response without circular references
interface WorkflowResponse {
	id: string;
	name: string;
	description?: string;
	category?: string;
	downloads?: number;
	isPublic?: boolean;
	authorName?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

@RestController('/marketplace')
export class MarketplaceController {
	constructor(private readonly marketplaceService: MarketplaceService) {}

	// Helper to convert marketplace workflow entity to safe serializable object
	private toWorkflowResponse(workflow: MarketplaceWorkflowEntity): WorkflowResponse {
		// Extract only the fields we need to avoid circular references
		return {
			id: workflow.id,
			name: workflow.name,
			description: workflow.description,
			category: workflow.category,
			downloads: workflow.downloads,
			isPublic: workflow.isPublic,
			authorName: workflow.authorName,
			createdAt: workflow.createdAt,
			updatedAt: workflow.updatedAt,
		};
	}

	// Endpoint to get all published workflows
	@Get('/')
	async getMarketplaceWorkflows(req: AuthenticatedRequest) {
		try {
			const workflows = await this.marketplaceService.findAll(req.user);
			// Return only serializable data
			return workflows.map((workflow) => this.toWorkflowResponse(workflow));
		} catch (error) {
			// Handle errors without circular references
			throw new Error(`Error fetching marketplace workflows: ${error.message}`);
		}
	}

	// Endpoint to publish a workflow
	@Post('/publish')
	async publishWorkflow(req: AuthenticatedRequest) {
		// Validate input
		const publishDto: PublishWorkflowDto = req.body;

		if (
			!publishDto ||
			!publishDto.name ||
			(!publishDto.description && !publishDto.useAutoDescription) ||
			!publishDto.category ||
			!publishDto.workflowId
		) {
			throw new BadRequestError(
				'Invalid request body for publishing workflow. Must include name, description (or enable auto-description), category, and workflowId.',
			);
		}

		// If description is empty but auto-description is enabled, we'll proceed
		if (!publishDto.description && !publishDto.useAutoDescription) {
			throw new BadRequestError(
				'Please provide a description or enable auto-description generation.',
			);
		}

		try {
			const workflow = await this.marketplaceService.publish(req.user, publishDto);
			// Return only serializable data
			return this.toWorkflowResponse(workflow);
		} catch (error) {
			// Handle errors without circular references
			throw new Error(`Error publishing workflow: ${error.message}`);
		}
	}

	// Endpoint to import a workflow
	@Post('/import/:id')
	async importWorkflow(req: AuthenticatedRequest) {
		try {
			// Extract the ID directly from the URL path
			const urlParts = req.originalUrl.split('/');
			const workflowId = urlParts[urlParts.length - 1];

			console.log('Import workflow debug info:', {
				params: req.params,
				paramsId: req.params.id,
				urlParts,
				extractedId: workflowId,
				urlPath: req.originalUrl,
			});

			// Ensure the ID is valid
			if (!workflowId || typeof workflowId !== 'string') {
				throw new BadRequestError('Invalid workflow ID provided');
			}

			// Pass the validated ID string to the service
			const workflow = await this.marketplaceService.import(req.user, workflowId);

			// Return only serializable data about the imported workflow
			return {
				id: workflow.id,
				name: workflow.name,
				active: workflow.active,
				createdAt: workflow.createdAt,
				updatedAt: workflow.updatedAt,
			};
		} catch (error) {
			// Log the error with more details
			console.error(`Workflow import error: ${error.message}`, {
				userId: req.user?.id,
				extractedUrlParts: req.originalUrl?.split('/'),
				error: error,
				errorName: error.name,
				stack: error.stack,
			});

			// Return a more specific error message
			if (
				error.message.includes('circular structure') ||
				error.message.includes('Converting circular')
			) {
				throw new Error(
					'Failed to import workflow due to circular references in the data structure. The workflow may contain complex HTTP connections that cannot be serialized.',
				);
			} else if (error.message.includes('not found')) {
				throw new Error(
					`Workflow not found. Please check if the workflow exists and is published.`,
				);
			} else {
				// Handle other errors without circular references
				throw new Error(`Error importing workflow: ${error.message}`);
			}
		}
	}

	// Endpoint to get user's own workflows (for the publish dropdown)
	@Get('/user-workflows')
	async getUserWorkflows(req: AuthenticatedRequest) {
		try {
			const workflows = await this.marketplaceService.findUserWorkflows(req.user);
			// Return only essential fields to avoid circular references
			return workflows.map((workflow) => ({
				id: workflow.id,
				name: workflow.name,
				active: workflow.active,
				createdAt: workflow.createdAt,
				updatedAt: workflow.updatedAt,
			}));
		} catch (error) {
			// Handle errors without circular references
			throw new Error(`Error fetching user workflows: ${error.message}`);
		}
	}

	// Endpoint to preview auto-generated description
	@Get('/preview-description/:id')
	async previewDescription(req: AuthenticatedRequest) {
		try {
			// Extract the workflow ID from params
			const workflowId = req.params.id;

			if (!workflowId) {
				throw new BadRequestError('Workflow ID is required');
			}

			const description = await this.marketplaceService.generateDescriptionPreview(
				req.user,
				workflowId,
			);

			return { description };
		} catch (error) {
			// Handle errors without circular references
			throw new Error(`Error generating description preview: ${error.message}`);
		}
	}
}
