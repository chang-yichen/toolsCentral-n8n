import { Get, Post, RestController, Param } from '@/decorators';
import { MarketplaceService } from '@/services/marketplace.service'; // Use alias path// Assume Request types exist or define basic ones
import type { Request as ExpressRequest } from 'express'; // Use Express types if applicable
import type { User } from '../databases/entities/user'; // Assuming User entity path

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
}

@RestController('/marketplace')
export class MarketplaceController {
	constructor(private readonly marketplaceService: MarketplaceService) {}

	// Endpoint to get all published workflows
	@Get('/')
	async getMarketplaceWorkflows(req: AuthenticatedRequest) {
		return await this.marketplaceService.findAll(req.user);
	}

	// Endpoint to publish a workflow
	@Post('/publish')
	async publishWorkflow(req: AuthenticatedRequest) {
		// Access body directly from the request object
		const publishDto: PublishWorkflowDto = req.body;

		// Optional: Add validation for publishDto here if needed
		if (
			!publishDto ||
			!publishDto.name ||
			!publishDto.description ||
			!publishDto.category ||
			!publishDto.workflowId
		) {
			// Consider throwing a proper validation error (e.g., BadRequestError)
			throw new Error('Invalid request body for publishing workflow');
		}

		return await this.marketplaceService.publish(req.user, publishDto);
	}

	// Endpoint to import a workflow
	@Post('/import/:id')
	async importWorkflow(req: AuthenticatedRequest, @Param('id') marketplaceWorkflowId: string) {
		return await this.marketplaceService.import(req.user, marketplaceWorkflowId);
	}

	// Endpoint to get user's own workflows (for the publish dropdown)
	// Note: This might logically belong in a different controller (e.g., WorkflowsController)
	// but placing it here for simplicity for now.
	@Get('/user-workflows')
	async getUserWorkflows(req: AuthenticatedRequest) {
		return await this.marketplaceService.findUserWorkflows(req.user);
	}
}
