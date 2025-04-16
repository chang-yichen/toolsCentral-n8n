# Automatic Workflow Description Generation

This feature uses AWS Bedrock with Claude models to automatically generate concise descriptions for your workflows when publishing them to the marketplace.

## Setup

To enable the automatic description generation, you need to set the following environment variables:

```
ANTHROPIC_ENABLED=true
ANTHROPIC_AWS_ACCESS_KEY_ID=your_aws_access_key
ANTHROPIC_AWS_SECRET_ACCESS_KEY=your_aws_secret_key
ANTHROPIC_AWS_REGION=your_aws_region
```

You can optionally set the following variables:
```
ANTHROPIC_MODEL=anthropic.claude-3-5-sonnet-20240620-v1:0  # Default model
ANTHROPIC_TEMP_DIR=/tmp  # Temp directory for processing
```

## How It Works

When publishing a workflow to the marketplace, you can enable the automatic description option, which will:

1. Process your workflow structure and extract key information
2. Send it to Claude via AWS Bedrock to generate a concise, meaningful description
3. Use the generated description instead of a manually entered one

## Fallback Behavior

If AWS Bedrock is unavailable or returns an error, the system will generate a basic description based on the workflow's nodes and structure. This ensures you always get a description even if the LLM service is unavailable.

## Privacy & Security

- Your workflow structure is sent to AWS Bedrock for processing
- No sensitive data such as credentials or connection details are sent
- Only basic node information and workflow structure are used for description generation
- AWS IAM permissions should be limited to Bedrock model invocation only

## Troubleshooting

If you experience issues with description generation:

1. Check that your AWS credentials are correct and have the necessary permissions
2. Verify the selected model is available in your AWS region
3. Check the logs for specific error messages
4. If all else fails, disable the feature and use manual descriptions

## Example Generated Descriptions

- "Automatically posts new Slack messages to a Notion database with custom properties."
- "Monitors Twitter for specific hashtags and sends daily email summaries of trending topics."
- "Syncs customer data between HubSpot and Salesforce with customized field mapping." 