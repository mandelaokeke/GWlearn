import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PipelineController, type S3ObjectCreatedEvent } from "./control.ts";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is required");

const controller = new PipelineController(
  DynamoDBDocumentClient.from(new DynamoDBClient({})),
  tableName,
);

export async function handler(input: {
  action?: "fail" | "initialize";
  error?: unknown;
  event?: S3ObjectCreatedEvent;
  videoId?: string;
}) {
  if (input.action === "fail") {
    await controller.fail(input);
    return { failed: true };
  }
  return controller.initialize(input.event ?? input as S3ObjectCreatedEvent);
}
