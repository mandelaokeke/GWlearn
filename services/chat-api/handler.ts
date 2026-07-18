import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import type { AuthenticatedActor } from "../upload-api/create-upload.ts";
import { DynamoVideoReadRepository, S3VideoReadStorage } from "../video-api/aws-adapters.ts";
import { BedrockLectureChatModel } from "./aws-adapters.ts";
import { createLectureChatUseCase } from "./chat.ts";

function actorFromEvent(event: APIGatewayProxyEventV2WithJWTAuthorizer): AuthenticatedActor | null {
  const subject = event.requestContext.authorizer.jwt.claims.sub;
  return typeof subject === "string" && subject ? { groups: [], subject } : null;
}

export function createHandler(chat: ReturnType<typeof createLectureChatUseCase>) {
  return async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) as unknown : null;
    } catch {
      return { body: JSON.stringify({ message: "Request body must be valid JSON." }), headers: { "content-type": "application/json; charset=utf-8" }, statusCode: 400 };
    }
    try {
      const result = await chat(actorFromEvent(event), event.pathParameters?.videoId ?? "", body);
      return { body: JSON.stringify(result.body), headers: { "content-type": "application/json; charset=utf-8" }, statusCode: result.statusCode };
    } catch (error) {
      console.error("Lecture chat failed", error);
      return { body: JSON.stringify({ message: "GWLearn could not answer that question. Please try again." }), headers: { "content-type": "application/json; charset=utf-8" }, statusCode: 500 };
    }
  };
}

let cached: ReturnType<typeof createHandler> | undefined;
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!cached) {
    const tableName = process.env.TABLE_NAME;
    const bucketName = process.env.MEDIA_BUCKET_NAME;
    const modelId = process.env.BEDROCK_MODEL_ID;
    if (!tableName || !bucketName || !modelId) throw new Error("TABLE_NAME, MEDIA_BUCKET_NAME, and BEDROCK_MODEL_ID are required");
    cached = createHandler(createLectureChatUseCase({
      model: new BedrockLectureChatModel(new BedrockRuntimeClient({}), modelId),
      repository: new DynamoVideoReadRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName),
      storage: new S3VideoReadStorage(new S3Client({}), bucketName),
    }));
  }
  return cached(event);
}
