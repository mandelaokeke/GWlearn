import assert from "node:assert/strict";
import test from "node:test";
import { parseBrowserAWSConfig } from "./aws-config.ts";

test("normalizes a complete HTTPS AWS browser configuration", () => {
  const result = parseBrowserAWSConfig({
    apiUrl: "https://api.example.com/",
    region: "us-east-1",
    userPoolClientId: "client-123",
    userPoolId: "us-east-1_pool123",
  });

  assert.deepEqual(result, {
    configured: true,
    value: {
      apiUrl: "https://api.example.com",
      region: "us-east-1",
      userPoolClientId: "client-123",
      userPoolId: "us-east-1_pool123",
    },
  });
});

test("reports incomplete, insecure, and cross-region configuration", () => {
  assert.deepEqual(
    parseBrowserAWSConfig({ region: "us-east-1" }),
    {
      configured: false,
      missing: ["apiUrl", "userPoolClientId", "userPoolId"],
    },
  );
  assert.deepEqual(
    parseBrowserAWSConfig({
      apiUrl: "http://api.example.com",
      region: "us-east-1",
      userPoolClientId: "client-123",
      userPoolId: "us-east-1_pool123",
    }),
    { configured: false, missing: ["validHttpsApiUrl"] },
  );
  assert.deepEqual(
    parseBrowserAWSConfig({
      apiUrl: "https://api.example.com",
      region: "us-east-1",
      userPoolClientId: "client-123",
      userPoolId: "eu-west-1_pool123",
    }),
    { configured: false, missing: ["matchingUserPoolRegion"] },
  );
});
