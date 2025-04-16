import type { IRestApiContext } from '@/Interface'; // Assuming context type path
import { makeRestApiRequest } from '@/utils/apiUtils';

// Backend response structure - updated to match MarketplaceWorkflowEntity
interface WorkflowResponse {
	id: string;
	name: string;
	description: string;
	category: string;
	createdAt: string;
	updatedAt: string;
	downloads: number;
	isPublic: boolean;
	authorName: string;
	authorId: string;
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
	authorId: string;
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
	// Add debugging to help diagnose description issues
	console.log('Processing workflow:', workflow.name, 'Description:', workflow.description);
	console.log('Backend authorId:', workflow.authorId);

	// Clean up and normalize the description
	let description = 'No description available';
	if (workflow.description && workflow.description.trim() !== '') {
		description = workflow.description.trim();
	}

	const transformedWorkflow = {
		id: workflow.id,
		name: workflow.name,
		description: description,
		category: workflow.category || 'Other',
		createdAt: workflow.createdAt,
		updatedAt: workflow.updatedAt,
		downloads: workflow.downloads || 0,
		author: workflow.authorName || 'n8n community',
		authorId: workflow.authorId,
		isPublic: workflow.isPublic,
	};

	console.log('Transformed workflow with authorId:', transformedWorkflow.authorId);
	return transformedWorkflow;
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

	console.log('Publishing to marketplace with data:', transformedData);

	try {
		const response = await makeRestApiRequest<WorkflowResponse>(
			context,
			'POST',
			`${BASE_ENDPOINT}/publish`,
			transformedData,
		);

		console.log('Publish API response:', response);

		// Transform the response to frontend format
		const transformedWorkflow = transformToFrontendFormat(response);
		console.log('Transformed workflow for frontend:', transformedWorkflow);

		return transformedWorkflow;
	} catch (error) {
		console.error('Error in publishToMarketplace API call:', error);
		throw error;
	}
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

// Function to delete a workflow from marketplace (admin or author only)
export async function deleteMarketplaceWorkflow(
	context: IRestApiContext,
	workflowId: string,
): Promise<{ success: boolean }> {
	if (!workflowId) {
		throw new Error('Workflow ID is required to delete workflow');
	}

	try {
		const response = await makeRestApiRequest<{ success: boolean }>(
			context,
			'DELETE',
			`${BASE_ENDPOINT}/${workflowId}`,
		);
		return response;
	} catch (error) {
		console.error('Error deleting marketplace workflow:', error);
		throw new Error(`Failed to delete workflow: ${error.message || 'Unknown error'}`);
	}
}
