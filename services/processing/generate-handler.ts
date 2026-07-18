import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { ArtifactGenerator } from "./generate.ts";

const tableName = process.env.TABLE_NAME;
const modelId = process.env.BEDROCK_MODEL_ID;
if (!tableName || !modelId) throw new Error("TABLE_NAME and BEDROCK_MODEL_ID are required");

const generator = new ArtifactGenerator(
  new S3Client({}),
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  new BedrockRuntimeClient({}),
  tableName,
  modelId,
);

export async function handler(input: {
  bucketName: string;
  ownerId: string;
  transcriptKey: string;
  videoId: string;
}) {
  return generator.generate(input);
}
