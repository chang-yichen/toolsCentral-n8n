import { Service } from '@n8n/di';
import { Logger } from 'n8n-core';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { IWorkflowDb } from '../interfaces';
import { ANTHROPIC_CONFIG } from '../config/anthropic.config';

@Service()
export class LlmDescriptionService {
	private readonly logger: Logger;
	private bedrockClient: BedrockRuntimeClient | null = null;
	private initialized = false;

	constructor(logger: Logger) {
		this.logger = logger;

		// Log config for debugging
		this.logger.info('LlmDescriptionService initializing with Anthropic config:', {
			enabled: ANTHROPIC_CONFIG.enabled,
			region: ANTHROPIC_CONFIG.awsRegion,
			model: ANTHROPIC_CONFIG.model,
			// Don't log credentials, but log if they're provided
			hasAwsAccessKey: !!ANTHROPIC_CONFIG.awsAccessKeyId,
			hasAwsSecretKey: !!ANTHROPIC_CONFIG.awsSecretAccessKey,
		});

		this.initializeBedrockClient();
		// Test the connection right away if initialized
		if (this.initialized) {
			this.testBedrockConnection();
		}
	}

	private initializeBedrockClient() {
		try {
			// Skip initialization if disabled
			if (!ANTHROPIC_CONFIG.enabled) {
				this.logger.info(
					'AWS Bedrock integration is disabled via configuration (ANTHROPIC_ENABLED is not set to true)',
				);
				return;
			}

			// Check if AWS credentials are provided
			if (!ANTHROPIC_CONFIG.awsAccessKeyId) {
				this.logger.error(
					'AWS access key is missing. Please set ANTHROPIC_AWS_ACCESS_KEY_ID in your .env file.',
				);
				return;
			}

			if (!ANTHROPIC_CONFIG.awsSecretAccessKey) {
				this.logger.error(
					'AWS secret key is missing. Please set ANTHROPIC_AWS_SECRET_ACCESS_KEY in your .env file.',
				);
				return;
			}

			if (!ANTHROPIC_CONFIG.awsRegion) {
				this.logger.error(
					'AWS region is not specified. Please set ANTHROPIC_AWS_REGION in your .env file.',
				);
				return;
			}

			if (!ANTHROPIC_CONFIG.model) {
				this.logger.error(
					'Anthropic model is not specified. Please set ANTHROPIC_MODEL in your .env file.',
				);
				return;
			}

			this.logger.info('Initializing AWS Bedrock client with config:', {
				enabled: ANTHROPIC_CONFIG.enabled,
				region: ANTHROPIC_CONFIG.awsRegion,
				model: ANTHROPIC_CONFIG.model,
				// Mask most of the access key ID for security
				accessKeyIdPrefix: ANTHROPIC_CONFIG.awsAccessKeyId
					? ANTHROPIC_CONFIG.awsAccessKeyId.substring(0, 4) + '...'
					: 'missing',
			});

			// Initialize the AWS Bedrock client
			this.bedrockClient = new BedrockRuntimeClient({
				region: ANTHROPIC_CONFIG.awsRegion,
				credentials: {
					accessKeyId: ANTHROPIC_CONFIG.awsAccessKeyId,
					secretAccessKey: ANTHROPIC_CONFIG.awsSecretAccessKey,
				},
			});

			this.initialized = true;
			this.logger.info('AWS Bedrock client initialized successfully');
		} catch (error) {
			this.logger.error('Failed to initialize AWS Bedrock client', {
				error,
				message: error.message,
				stack: error.stack,
			});
			this.initialized = false;
		}
	}

	private async testBedrockConnection() {
		try {
			if (!this.initialized || !this.bedrockClient) {
				this.logger.warn('Cannot test Bedrock connection - client not initialized');
				return;
			}

			this.logger.info('Testing AWS Bedrock connection...');

			// Simple test prompt
			const testRequest = {
				anthropic_version: 'bedrock-2023-05-31',
				max_tokens: 20,
				temperature: 0.2,
				messages: [
					{
						role: 'user',
						content: 'Say hello in one word',
					},
				],
			};

			const command = new InvokeModelCommand({
				modelId: ANTHROPIC_CONFIG.model,
				contentType: 'application/json',
				body: JSON.stringify(testRequest),
			});

			const response = await this.bedrockClient.send(command);
			const responseText = new TextDecoder().decode(response.body);
			const responseJson = JSON.parse(responseText);

			this.logger.info('AWS Bedrock connection test successful:', {
				response: responseJson.content[0].text.trim(),
			});
		} catch (error) {
			this.logger.error('AWS Bedrock connection test failed:', {
				error,
				message: error.message,
				code: error.code,
				stack: error.stack?.split('\n').slice(0, 3).join('\n'),
			});
		}
	}

	/**
	 * Generate a concise description (max 30 words) for a workflow based on its structure
	 */
	async generateWorkflowDescription(workflow: IWorkflowDb): Promise<string> {
		if (!ANTHROPIC_CONFIG.enabled) {
			this.logger.debug('Auto description generation is disabled');
			return '';
		}

		if (!this.initialized || !this.bedrockClient) {
			this.logger.warn('AWS Bedrock client not initialized, returning fallback description', {
				initialized: this.initialized,
				clientExists: !!this.bedrockClient,
				enabled: ANTHROPIC_CONFIG.enabled,
				hasAwsAccessKey: !!ANTHROPIC_CONFIG.awsAccessKeyId,
				hasAwsSecretKey: !!ANTHROPIC_CONFIG.awsSecretAccessKey,
				region: ANTHROPIC_CONFIG.awsRegion,
				model: ANTHROPIC_CONFIG.model,
			});
			return this.generateFallbackDescription(workflow);
		}

		try {
			this.logger.debug('Generating workflow description for workflow:', {
				workflowId: workflow.id,
				workflowName: workflow.name,
			});

			// Extract relevant information from the workflow
			const workflowInfo = {
				name: workflow.name,
				nodes: workflow.nodes.map((node) => ({
					name: node.name,
					type: node.type,
					parameters: node.parameters,
				})),
				connections: workflow.connections,
			};

			// Create a prompt for Claude model
			const prompt = `
Based on this workflow JSON, generate a clear, concise description (maximum 30 words) explaining what this workflow does.
Focus on the main purpose and outcome, not technical details.

Workflow: ${JSON.stringify(workflowInfo, null, 2)}

Description: 
`;

			// Format the request as required by Claude on AWS Bedrock
			const claudeRequest = {
				anthropic_version: 'bedrock-2023-05-31',
				max_tokens: 100,
				temperature: 0.2,
				messages: [
					{
						role: 'user',
						content: prompt,
					},
				],
			};

			// Call the Claude model via AWS Bedrock
			const command = new InvokeModelCommand({
				modelId: ANTHROPIC_CONFIG.model,
				contentType: 'application/json',
				body: JSON.stringify(claudeRequest),
			});

			const response = await this.bedrockClient.send(command);

			// Parse the response
			const responseText = new TextDecoder().decode(response.body);
			const responseJson = JSON.parse(responseText);
			const description = responseJson.content[0].text.trim();

			// Truncate if necessary to keep under 30 words
			const words = description.split(/\s+/);
			if (words.length > 30) {
				return words.slice(0, 30).join(' ');
			}

			return description;
		} catch (error) {
			this.logger.error('Error generating workflow description with AWS Bedrock', {
				workflowId: workflow.id,
				error,
				message: error.message,
				code: error.code,
				name: error.name,
				stack: error.stack?.split('\n').slice(0, 3).join('\n'), // Only log first few lines of stack
				model: ANTHROPIC_CONFIG.model,
				region: ANTHROPIC_CONFIG.awsRegion,
			});

			// Use fallback description generation when AWS Bedrock fails
			return this.generateFallbackDescription(workflow);
		}
	}

	/**
	 * Generate a basic description using workflow metadata when AWS Bedrock is unavailable
	 * This is a simple fallback mechanism that creates a description based on node types
	 */
	private generateFallbackDescription(workflow: IWorkflowDb): string {
		try {
			// Get unique node types (excluding special n8n nodes)
			const nodeTypes = new Set<string>();
			const triggerNodes: string[] = [];
			const actionNodes: string[] = [];

			workflow.nodes.forEach((node) => {
				const type = node.type.split('.').pop() || '';

				// Skip n8n system nodes
				if (type.startsWith('n8n-nodes-base.')) {
					return;
				}

				// Categorize nodes
				if (node.type.toLowerCase().includes('trigger')) {
					triggerNodes.push(type);
				} else {
					actionNodes.push(type);
				}

				nodeTypes.add(type);
			});

			// Create a basic description
			let description = `Workflow "${workflow.name}"`;

			// Add trigger information if available
			if (triggerNodes.length > 0) {
				const triggerText = triggerNodes.slice(0, 2).join(' and ');
				description += ` triggered by ${triggerText}`;

				if (triggerNodes.length > 2) {
					description += ' and more';
				}
			}

			// Add actions information if available
			if (actionNodes.length > 0) {
				const actionText = actionNodes.slice(0, 3).join(', ');
				description += ` using ${actionText}`;

				if (actionNodes.length > 3) {
					description += ' and more';
				}
			}

			// Add node count
			description += ` (${workflow.nodes.length} nodes total)`;

			return description;
		} catch (error) {
			// Last resort fallback
			return `Workflow "${workflow.name}" with ${workflow.nodes.length} nodes`;
		}
	}
}
