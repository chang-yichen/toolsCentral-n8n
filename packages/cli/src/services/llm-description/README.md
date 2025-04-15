# Automatic Workflow Description Generation

This feature enables automatic generation of concise workflow descriptions (max 30 words) when publishing workflows to the marketplace. It uses the Anthropic Claude LLM model through AWS Bedrock to analyze the workflow structure and generate a human-readable description.

## Setup

1. Install the required dependency:
   ```
   pnpm add @aws-sdk/client-bedrock-runtime --filter "*cli*"
   ```

2. Configure the AWS Bedrock integration by setting these environment variables:

   ```
   # Enable the integration
   ANTHROPIC_ENABLED=true
   
   # AWS credentials for Bedrock
   ANTHROPIC_AWS_ACCESS_KEY_ID=your_aws_access_key
   ANTHROPIC_AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   ANTHROPIC_AWS_REGION=us-east-1  # or your preferred region
   
   # Optional: Override the model
   ANTHROPIC_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
   ```

   You can also use standard AWS credential environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) or AWS credential providers (like `~/.aws/credentials`).

## How It Works

1. When publishing a workflow to the marketplace, users can check the "Generate description automatically" option.
2. The system will send the workflow structure (nodes, connections, etc.) to the Anthropic Claude model via AWS Bedrock.
3. The LLM analyzes the workflow and generates a concise description (max 30 words).
4. The generated description is saved as the workflow's marketplace description.

## Troubleshooting

If auto-description generation is not working:

1. Check the logs for any errors from the LlmDescriptionService.
2. Verify that `ANTHROPIC_ENABLED` is set to `true`.
3. Ensure AWS credentials have the necessary permissions to access Claude models on AWS Bedrock.
4. Make sure you have access to the specified Claude model in your AWS Bedrock service.
5. Verify that the model ID is correct for your region and account.

## Security Considerations

- No sensitive workflow data is sent to external services. Only the workflow structure (not credentials or sensitive parameters) is sent to the LLM.
- AWS credentials should have the minimum necessary permissions to access the Anthropic Claude model on Bedrock.
- Consider using IAM roles and temporary credentials rather than long-lived access keys when possible. 