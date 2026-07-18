import type { BrowserAWSConfigInput } from "../packages/browser/aws-config";

export function awsRuntimeConfig(): BrowserAWSConfigInput {
  return {
    apiUrl: process.env.NEXT_PUBLIC_GWLEARN_API_URL,
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    userPoolClientId: process.env.NEXT_PUBLIC_GWLEARN_USER_POOL_CLIENT_ID,
    userPoolId: process.env.NEXT_PUBLIC_GWLEARN_USER_POOL_ID,
  };
}
