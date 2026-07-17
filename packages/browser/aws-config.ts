export interface BrowserAWSConfig {
  apiUrl: string;
  region: string;
  userPoolClientId: string;
  userPoolId: string;
}

export type BrowserConfigResult =
  | { configured: true; value: BrowserAWSConfig }
  | { configured: false; missing: string[] };

export function parseBrowserAWSConfig(input: {
  apiUrl?: string;
  region?: string;
  userPoolClientId?: string;
  userPoolId?: string;
}): BrowserConfigResult {
  const fields = [
    "apiUrl",
    "region",
    "userPoolClientId",
    "userPoolId",
  ] as const;
  const missing = fields.filter((key) => !input[key]?.trim());
  if (missing.length > 0) return { configured: false, missing };

  const apiUrl = input.apiUrl!.trim().replace(/\/+$/, "");
  const region = input.region!.trim();
  const userPoolId = input.userPoolId!.trim();
  const userPoolClientId = input.userPoolClientId!.trim();
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(apiUrl);

  if (!apiUrl.startsWith("https://") && !isLocal) {
    return { configured: false, missing: ["validHttpsApiUrl"] };
  }
  if (!userPoolId.startsWith(`${region}_`)) {
    return { configured: false, missing: ["matchingUserPoolRegion"] };
  }

  return {
    configured: true,
    value: { apiUrl, region, userPoolClientId, userPoolId },
  };
}

export function browserAWSConfig(): BrowserConfigResult {
  return parseBrowserAWSConfig({
    apiUrl: process.env.NEXT_PUBLIC_GWLEARN_API_URL,
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    userPoolClientId: process.env.NEXT_PUBLIC_GWLEARN_USER_POOL_CLIENT_ID,
    userPoolId: process.env.NEXT_PUBLIC_GWLEARN_USER_POOL_ID,
  });
}
