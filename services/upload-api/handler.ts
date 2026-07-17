import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { createUploadUseCase, type AuthenticatedActor } from "./create-upload.ts";
import { DynamoUploadRepository, S3UploadStorage } from "./aws-adapters.ts";

interface HandlerEnvironment {
  MEDIA_BUCKET_NAME: string;
  TABLE_NAME: string;
}

interface HandlerDependencies {
  execute: ReturnType<typeof createUploadUseCase>;
}

function readEnvironment(environment: NodeJS.ProcessEnv): HandlerEnvironment {
  const tableName = environment.TABLE_NAME;
  const bucketName = environment.MEDIA_BUCKET_NAME;
  if (!tableName || !bucketName) {
    throw new Error("TABLE_NAME and MEDIA_BUCKET_NAME must be configured");
  }
  return { MEDIA_BUCKET_NAME: bucketName, TABLE_NAME: tableName };
}

function groupsFromClaim(claim: unknown): string[] {
  if (Array.isArray(claim)) {
    return claim.filter((value): value is string => typeof value === "string");
  }
  if (typeof claim !== "string" || claim.trim() === "") return [];
  return claim.split(/[ ,]+/).filter(Boolean);
}

function actorFromEvent(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): AuthenticatedActor | null {
  const claims = event.requestContext.authorizer.jwt.claims;
  const subject = claims.sub;
  if (typeof subject !== "string" || subject === "") return null;
  return {
    groups: groupsFromClaim(claims["cognito:groups"]),
    subject,
  };
}

export function createHandler(dependencies: HandlerDependencies) {
  return async function handler(
    event: APIGatewayProxyEventV2WithJWTAuthorizer,
  ): Promise<APIGatewayProxyStructuredResultV2> {
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return json(400, { message: "Request body must be valid JSON" });
    }

    const result = await dependencies.execute(actorFromEvent(event), body);
    return json(result.statusCode, result.body);
  };
}

function json(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json; charset=utf-8" },
    statusCode,
  };
}

function productionDependencies(): HandlerDependencies {
  const environment = readEnvironment(process.env);
  const repository = new DynamoUploadRepository(
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    environment.TABLE_NAME,
  );
  const storage = new S3UploadStorage(
    new S3Client({}),
    environment.MEDIA_BUCKET_NAME,
  );
  return {
    execute: createUploadUseCase({
      clock: { now: () => new Date() },
      ids: { create: randomUUID },
      repository,
      storage,
    }),
  };
}

let cachedHandler: ReturnType<typeof createHandler> | undefined;

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  cachedHandler ??= createHandler(productionDependencies());
  return cachedHandler(event);
}
