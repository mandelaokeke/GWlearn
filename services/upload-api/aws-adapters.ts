import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import {
  createPresignedPost,
  type PresignedPost,
  type PresignedPostOptions,
} from "@aws-sdk/s3-presigned-post";
import type {
  PendingVideo,
  UploadRepository,
  UploadStorage,
} from "./create-upload.ts";

type PresignPost = (
  client: S3Client,
  options: PresignedPostOptions,
) => Promise<PresignedPost>;

export class DynamoUploadRepository implements UploadRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async createPendingVideo(video: PendingVideo): Promise<void> {
    const { gsi1pk, gsi1sk, pk, sk, ...metadata } = video;

    await this.client.send(
      new PutCommand({
        ConditionExpression: "attribute_not_exists(PK)",
        Item: {
          ...metadata,
          entityType: "VIDEO",
          GSI1PK: gsi1pk,
          GSI1SK: gsi1sk,
          PK: pk,
          SK: sk,
        },
        TableName: this.tableName,
      }),
    );
  }

  async deletePendingVideo(videoId: string, ownerId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        ConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: { ":ownerId": ownerId },
        Key: { PK: `VIDEO#${videoId}`, SK: "METADATA" },
        TableName: this.tableName,
      }),
    );
  }
}

export class S3UploadStorage implements UploadStorage {
  private readonly bucketName: string;
  private readonly client: S3Client;
  private readonly presign: PresignPost;

  constructor(
    client: S3Client,
    bucketName: string,
    presign: PresignPost = createPresignedPost,
  ) {
    this.client = client;
    this.bucketName = bucketName;
    this.presign = presign;
  }

  async createUploadGrant(input: Parameters<UploadStorage["createUploadGrant"]>[0]) {
    const fields = {
      "Content-Type": input.contentType,
      "x-amz-checksum-sha256": input.checksumSha256,
    };
    const post = await this.presign(this.client, {
      Bucket: this.bucketName,
      Conditions: [
        ["content-length-range", 1, input.maxBytes],
        ["eq", "$Content-Type", input.contentType],
        ["eq", "$x-amz-checksum-sha256", input.checksumSha256],
      ],
      Expires: input.expiresInSeconds,
      Fields: fields,
      Key: input.objectKey,
    });

    return {
      fields: post.fields,
      method: "POST" as const,
      objectKey: input.objectKey,
      url: post.url,
      videoId: input.videoId,
    };
  }
}
