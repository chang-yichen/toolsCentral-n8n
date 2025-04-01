import type { IRestApiContext } from '@/Interface'; // Assuming context type path
import { makeRestApiRequest } from '@/utils/apiUtils';

// Define interfaces for expected data structures (align with backend)
interface MarketplaceWorkflow {
	id: string;
	name: string;
	description: string;
	category: string;
	authorId: string;
	authorName: string;
	downloads: number;
	isPublic: boolean;
	createdAt: string; // Assuming ISO string date
	updatedAt: string;
	// workflowJson might not be needed on the frontend list view
}

interface UserWorkflow {
	id: string;
	name: string;
	// Add other relevant fields if needed (active, createdAt, etc.)
}

interface PublishData {
	name: string;
	description: string;
	category: string;
	workflowId: string;
	isPublic?: boolean;
}

const BASE_ENDPOINT = '/marketplace';

// Function to get marketplace workflows
export async function getMarketplaceWorkflows(
	context: IRestApiContext,
): Promise<MarketplaceWorkflow[]> {
	// GET /marketplace
	return await makeRestApiRequest<MarketplaceWorkflow[]>(context, 'GET', BASE_ENDPOINT);
}

// Function to get user's workflows for publishing dropdown
export async function getUserWorkflows(context: IRestApiContext): Promise<UserWorkflow[]> {
	// GET /marketplace/user-workflows
	return await makeRestApiRequest<UserWorkflow[]>(
		context,
		'GET',
		`${BASE_ENDPOINT}/user-workflows`,
	);
}

// Function to publish a workflow
export async function publishToMarketplace(
	context: IRestApiContext,
	data: PublishData,
): Promise<MarketplaceWorkflow> {
	// POST /marketplace/publish
	return await makeRestApiRequest<MarketplaceWorkflow>(
		context,
		'POST',
		`${BASE_ENDPOINT}/publish`,
		data,
	);
}

// Function to import a workflow (copy to user's workflows)
export async function importMarketplaceWorkflow(
	context: IRestApiContext,
	marketplaceWorkflowId: string,
): Promise<UserWorkflow> {
	// Returns the newly created user workflow
	// POST /marketplace/import/:id
	return await makeRestApiRequest<UserWorkflow>(
		context,
		'POST',
		`${BASE_ENDPOINT}/import/${marketplaceWorkflowId}`,
	);
}
