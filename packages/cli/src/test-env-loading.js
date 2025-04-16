// Simple script to test if .env loading is working
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load the .env file from the root directory
const rootDir = path.resolve(__dirname, '../../..');
const envPath = path.join(rootDir, '.env');

console.log('Checking for .env file at:', envPath);

if (fs.existsSync(envPath)) {
	console.log('.env file found!');

	// Load environment variables
	const result = dotenv.config({ path: envPath });

	if (result.error) {
		console.error('Error loading .env file:', result.error.message);
	} else {
		console.log('Successfully loaded environment variables');

		// Check for Anthropic variables
		console.log('\nAnthropic Environment Variables:');
		console.log('ANTHROPIC_ENABLED:', process.env.ANTHROPIC_ENABLED);
		console.log('ANTHROPIC_AWS_REGION:', process.env.ANTHROPIC_AWS_REGION);
		console.log('ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL);

		// Don't log the actual credentials, just if they exist
		console.log('ANTHROPIC_AWS_ACCESS_KEY_ID exists:', !!process.env.ANTHROPIC_AWS_ACCESS_KEY_ID);
		console.log(
			'ANTHROPIC_AWS_SECRET_ACCESS_KEY exists:',
			!!process.env.ANTHROPIC_AWS_SECRET_ACCESS_KEY,
		);
	}
} else {
	console.error('No .env file found at the specified path:', envPath);
}
