import assert from "node:assert/strict";
import test from "node:test";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { createHandler } from "./handler.ts";
import type { AuthenticatedActor, CreateUploadResult } from "./create-upload.ts";

function event(body: string, claims: Record<string, string> = {}) {
  return {
    body,
    requestContext: { authorizer: { jwt: { claims, scopes: null } } },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

test("rejects malformed JSON before executing application logic", async () => {
  let executed = false;
  const handler = createHandler({
    async execute() {
      executed = true;
      return { body: { message: "unexpected" }, statusCode: 500 };
    },
  });

  const response = await handler(event("{"));
  assert.equal(response.statusCode, 400);
  assert.equal(executed, false);
  assert.deepEqual(JSON.parse(response.body as string), {
    message: "Request body must be valid JSON",
  });
});

test("derives identity and groups only from verified JWT claims", async () => {
  let actor: AuthenticatedActor | null = null;
  const expected: CreateUploadResult = {
    body: { message: "Authentication required" },
    statusCode: 401,
  };
  const handler = createHandler({
    async execute(receivedActor) {
      actor = receivedActor;
      return expected;
    },
  });

  const response = await handler(
    event('{"ownerId":"attacker"}', {
      "cognito:groups": "students faculty",
      sub: "verified-user-42",
    }),
  );

  assert.deepEqual(actor, {
    groups: ["students", "faculty"],
    subject: "verified-user-42",
  });
  assert.equal(response.statusCode, 401);
});
