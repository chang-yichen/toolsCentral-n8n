/**
 * Configuration for AWS Bedrock integration with Anthropic Claude LLM
 *
 * These settings can be configured through environment variables:
 * - ANTHROPIC_AWS_ACCESS_KEY_ID: AWS access key for Bedrock
 * - ANTHROPIC_AWS_SECRET_ACCESS_KEY: AWS secret key for Bedrock
 * - ANTHROPIC_AWS_REGION: AWS region for Bedrock (default: us-east-1)
 * - ANTHROPIC_MODEL: Model ID to use (default: anthropic.claude-3-sonnet-20240229-v1:0)
 * - ANTHROPIC_ENABLED: Whether to enable the integration (default: false)
 */

export const ANTHROPIC_CONFIG = {
	enabled: process.env.ANTHROPIC_ENABLED === 'true',
	awsAccessKeyId: process.env.ANTHROPIC_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
	awsSecretAccessKey:
		process.env.ANTHROPIC_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
	awsRegion: process.env.ANTHROPIC_AWS_REGION || process.env.AWS_REGION || 'ap-southeast-1',
	model: process.env.ANTHROPIC_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
	tempDir: process.env.ANTHROPIC_TEMP_DIR || '/tmp',
};
