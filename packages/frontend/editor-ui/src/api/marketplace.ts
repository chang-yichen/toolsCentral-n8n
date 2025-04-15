import type { IRestApiContext } from '@/Interface'; // Assuming context type path
import { makeRestApiRequest } from '@/utils/apiUtils';

// Backend response structure
interface WorkflowResponse {
	id: string;
	name: string;
	marketplaceDescription: string;
	marketplaceCategory: string;
	createdAt: string;
	updatedAt: string;
	marketplaceDownloads: number;
	marketplaceIsPublic: boolean;
}

// Frontend interface for marketplace workflows
interface MarketplaceWorkflow {
	id: string;
	name: string;
	description: string;
	category: string;
	createdAt: string;
	updatedAt: string;
	downloads: number;
	author: string;
	isPublic: boolean;
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
	useAutoDescription?: boolean;
}

const BASE_ENDPOINT = '/marketplace';

// Transform from backend to frontend format
function transformToFrontendFormat(workflow: WorkflowResponse): MarketplaceWorkflow {
	return {
		id: workflow.id,
		name: workflow.name,
		description: workflow.marketplaceDescription || '',
		category: workflow.marketplaceCategory || 'Other',
		createdAt: workflow.createdAt,
		updatedAt: workflow.updatedAt,
		downloads: workflow.marketplaceDownloads || 0,
		author: 'n8n community',
		isPublic: workflow.marketplaceIsPublic,
	};
}

// Function to get marketplace workflows
export async function getMarketplaceWorkflows(
	context: IRestApiContext,
): Promise<MarketplaceWorkflow[]> {
	const response = await makeRestApiRequest<WorkflowResponse[]>(context, 'GET', BASE_ENDPOINT);
	return response.map(transformToFrontendFormat);
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
	// Transform to backend format
	const transformedData = {
		name: data.name,
		workflowId: data.workflowId,
		description: data.description,
		category: data.category,
		isPublic: data.isPublic,
		useAutoDescription: data.useAutoDescription,
	};

	const response = await makeRestApiRequest<WorkflowResponse>(
		context,
		'POST',
		`${BASE_ENDPOINT}/publish`,
		transformedData,
	);

	return transformToFrontendFormat(response);
}

// Function to import a workflow (copy to user's workflows)
export async function importMarketplaceWorkflow(
	context: IRestApiContext,
	marketplaceWorkflowId: string,
): Promise<UserWorkflow> {
	// Validate input
	if (!marketplaceWorkflowId || typeof marketplaceWorkflowId !== 'string') {
		throw new Error('Invalid workflow ID provided');
	}

	// Make sure we're passing the ID as a clean string without any potential objects
	const cleanId = marketplaceWorkflowId.toString().trim();

	try {
		// Returns the newly created user workflow
		// POST /marketplace/import/:id
		return await makeRestApiRequest<UserWorkflow>(
			context,
			'POST',
			`${BASE_ENDPOINT}/import/${cleanId}`,
		);
	} catch (error) {
		console.error('Error importing workflow:', error);

		// Enhance error message if needed
		if (error.message && error.message.includes('not found')) {
			throw new Error(`Workflow not found. Please check if the workflow exists and is published.`);
		}

		// Re-throw the error with additional context
		throw error;
	}
}

// Function to get a preview of the auto-generated description
export async function getAutoDescriptionPreview(
	context: IRestApiContext,
	workflowId: string,
): Promise<string> {
	if (!workflowId) {
		throw new Error('Workflow ID is required to generate description preview');
	}

	try {
		const response = await makeRestApiRequest<{ description: string }>(
			context,
			'GET',
			`${BASE_ENDPOINT}/preview-description/${workflowId}`,
		);
		return response.description;
	} catch (error) {
		console.error('Error getting description preview:', error);
		throw new Error(`Failed to generate description preview: ${error.message || 'Unknown error'}`);
	}
}
