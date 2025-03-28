// Define our mock data
const MOCK_WORKFLOWS = [
	{
		id: '1',
		name: 'Email Automation',
		description: 'Automatically send emails based on triggers',
		author: 'Demo User',
		downloads: 120,
		createdAt: new Date().toISOString(),
	},
	{
		id: '2',
		name: 'Data Backup Workflow',
		description: 'Regularly backup your data to cloud storage',
		author: 'Test User',
		downloads: 85,
		createdAt: new Date().toISOString(),
	},
	{
		id: '3',
		name: 'Social Media Posting',
		description: 'Schedule and post to multiple social platforms',
		author: 'Admin',
		downloads: 230,
		createdAt: new Date().toISOString(),
	},
];

// Mock user workflows
const USER_WORKFLOWS = [
	{
		id: 'user-wf-1',
		name: 'My Email Workflow',
		active: false,
		createdAt: Date.now() - 1000000,
		updatedAt: Date.now() - 500000,
	},
	{
		id: 'user-wf-2',
		name: 'Data Processing Workflow',
		active: true,
		createdAt: Date.now() - 2000000,
		updatedAt: Date.now() - 100000,
	},
	{
		id: 'user-wf-3',
		name: 'Social Media Integration',
		active: false,
		createdAt: Date.now() - 3000000,
		updatedAt: Date.now() - 300000,
	},
];

// Simple function to simulate API calls
export async function getMarketplaceWorkflows() {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 500));
	return MOCK_WORKFLOWS;
}

// Function to get user's workflows
export async function getUserWorkflows() {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 300));
	return USER_WORKFLOWS;
}

// Function to simulate publishing
export async function publishToMarketplace(data: {
	name: string;
	description: string;
	category: string;
	isPublic: boolean;
	workflowId: string;
}) {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 800));

	// Return a mock response with the data
	return {
		id: Math.random().toString(36).substring(2, 10),
		...data,
		author: 'Current User',
		downloads: 0,
		createdAt: new Date().toISOString(),
	};
}
