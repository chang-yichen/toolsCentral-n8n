import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

// Directly load the .env file from the root directory
try {
	// Get the root directory of the project
	const rootDir = path.resolve(__dirname, '../../../..');
	const envPath = path.join(rootDir, '.env');

	if (fs.existsSync(envPath)) {
		const result = config({ path: envPath });
		if (result.error) {
			console.error(`Error loading .env file: ${result.error.message}`);
		} else {
			console.log(`Loaded Anthropic environment variables from ${envPath}`);
			console.log('ANTHROPIC_ENABLED:', process.env.ANTHROPIC_ENABLED);
			console.log('ANTHROPIC_AWS_REGION:', process.env.ANTHROPIC_AWS_REGION);
			console.log('ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL);
			// Don't log credentials, but log if they're present
			console.log(
				'Has AWS credentials:',
				!!process.env.ANTHROPIC_AWS_ACCESS_KEY_ID && !!process.env.ANTHROPIC_AWS_SECRET_ACCESS_KEY,
			);
		}
	} else {
		console.warn(`No .env file found at ${envPath}`);
	}
} catch (error) {
	console.error('Error loading .env file:', error);
}

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
