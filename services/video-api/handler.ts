import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthenticatedActor } from "../upload-api/create-upload.ts";
import { DynamoVideoReadRepository, S3VideoReadStorage } from "./aws-adapters.ts";
import { createVideoReadUseCase } from "./read-videos.ts";

function actorFromEvent(event: APIGatewayProxyEventV2WithJWTAuthorizer): AuthenticatedActor | null {
  const subject = event.requestContext.authorizer.jwt.claims.sub;
  return typeof subject === "string" && subject ? { groups: [], subject } : null;
}

export function createHandler(read: ReturnType<typeof createVideoReadUseCase>) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    const actor = actorFromEvent(event);
    const videoId = event.pathParameters?.videoId;
    const result = videoId ? await read.get(actor, videoId) : await read.list(actor);
    return { body: JSON.stringify(result.body), headers: { "content-type": "application/json; charset=utf-8" }, statusCode: result.statusCode };
  };
}

let cached: ReturnType<typeof createHandler> | undefined;
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!cached) {
    const tableName = process.env.TABLE_NAME;
    const bucketName = process.env.MEDIA_BUCKET_NAME;
    if (!tableName || !bucketName) throw new Error("TABLE_NAME and MEDIA_BUCKET_NAME are required");
    cached = createHandler(createVideoReadUseCase({
      repository: new DynamoVideoReadRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName),
      storage: new S3VideoReadStorage(new S3Client({}), bucketName),
    }));
  }
  return cached(event);
}
