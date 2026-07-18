import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export interface S3ObjectCreatedEvent {
  detail?: {
    bucket?: { name?: string };
    object?: { key?: string };
  };
}

export interface PipelineInput {
  bucketName: string;
  languageCode: string;
  mediaFormat: "mp4" | "mov" | "webm";
  mediaUri: string;
  ownerId: string;
  skip: false;
  transcriptKey: string;
  transcriptionJobName: string;
  videoId: string;
}

export type InitializeResult = PipelineInput | { reason: string; skip: true };

const sourceKeyPattern = /^private\/([^/]+)\/videos\/([^/]+)\/source\.(mp4|mov|webm)$/;

export function parseSourceEvent(event: S3ObjectCreatedEvent) {
  const bucketName = event.detail?.bucket?.name;
  const objectKey = event.detail?.object?.key;
  const match = objectKey?.match(sourceKeyPattern);
  if (!bucketName || !objectKey || !match) {
    throw new Error("The event does not describe a supported GWLearn source video");
  }

  return {
    bucketName,
    mediaFormat: match[3] as PipelineInput["mediaFormat"],
    objectKey,
    ownerId: match[1],
    videoId: match[2],
  };
}

export class PipelineController {
  private readonly client: DynamoDBDocumentClient;
  private readonly clock: { now(): Date };
  private readonly tableName: string;

  constructor(
    client: DynamoDBDocumentClient,
    tableName: string,
    clock: { now(): Date } = { now: () => new Date() },
  ) {
    this.client = client;
    this.clock = clock;
    this.tableName = tableName;
  }

  async initialize(event: S3ObjectCreatedEvent): Promise<InitializeResult> {
    const source = parseSourceEvent(event);
    const key = { PK: `VIDEO#${source.videoId}`, SK: "METADATA" };
    const record = await this.client.send(
      new GetCommand({ ConsistentRead: true, Key: key, TableName: this.tableName }),
    );
    const item = record.Item;

    if (!item || item.ownerId !== source.ownerId || item.objectKey !== source.objectKey) {
      throw new Error("The uploaded object does not match an owner-scoped video record");
    }
    if (item.status !== "UPLOADING") {
      return { reason: `Video is already ${String(item.status)}`, skip: true };
    }

    const now = this.clock.now().toISOString();
    await this.updateStatus(key, "UPLOADING", "QUEUED", now);
    await this.updateStatus(key, "QUEUED", "TRANSCRIBING", now);

    return {
      bucketName: source.bucketName,
      languageCode: String(item.languageCode),
      mediaFormat: source.mediaFormat,
      mediaUri: `s3://${source.bucketName}/${source.objectKey}`,
      ownerId: source.ownerId,
      skip: false,
      transcriptKey: `private/${source.ownerId}/videos/${source.videoId}/transcript/transcribe.json`,
      transcriptionJobName: `gwlearn-${source.videoId}`.slice(0, 200),
      videoId: source.videoId,
    };
  }

  async fail(input: { error?: unknown; event?: S3ObjectCreatedEvent; videoId?: string }): Promise<void> {
    const videoId = input.videoId ?? parseSourceEvent(input.event ?? input as S3ObjectCreatedEvent).videoId;
    const now = this.clock.now().toISOString();
    await this.client.send(
      new UpdateCommand({
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":failed": "FAILED",
          ":reason": JSON.stringify(input.error ?? "Pipeline failed").slice(0, 1000),
          ":updatedAt": now,
        },
        Key: { PK: `VIDEO#${videoId}`, SK: "METADATA" },
        TableName: this.tableName,
        UpdateExpression: "SET #status = :failed, failureReason = :reason, updatedAt = :updatedAt",
      }),
    );
  }

  private async updateStatus(
    key: { PK: string; SK: string },
    current: string,
    next: string,
    updatedAt: string,
  ) {
    await this.client.send(
      new UpdateCommand({
        ConditionExpression: "#status = :current",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":current": current, ":next": next, ":updatedAt": updatedAt },
        Key: key,
        TableName: this.tableName,
        UpdateExpression: "SET #status = :next, updatedAt = :updatedAt",
      }),
    );
  }
}
