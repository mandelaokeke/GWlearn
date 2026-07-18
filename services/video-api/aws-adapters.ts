import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { LearningArtifacts } from "../../packages/contracts/library.ts";
import type { StoredVideo, VideoReadRepository, VideoReadStorage } from "./read-videos.ts";

export class DynamoVideoReadRepository implements VideoReadRepository {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly tableName: string) {}

  async findOwnedVideo(ownerId: string, videoId: string): Promise<StoredVideo | null> {
    const result = await this.client.send(new GetCommand({
      Key: { PK: `VIDEO#${videoId}`, SK: "METADATA" },
      TableName: this.tableName,
    }));
    if (!result.Item || result.Item.ownerId !== ownerId) return null;
    return result.Item as StoredVideo;
  }

  async listOwnedVideos(ownerId: string): Promise<StoredVideo[]> {
    const result = await this.client.send(new QueryCommand({
      ExpressionAttributeValues: { ":owner": `OWNER#${ownerId}` },
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :owner",
      Limit: 50,
      ScanIndexForward: false,
      TableName: this.tableName,
    }));
    return (result.Items ?? []) as StoredVideo[];
  }
}

export class S3VideoReadStorage implements VideoReadStorage {
  constructor(private readonly client: S3Client, private readonly bucketName: string, private readonly now: () => Date = () => new Date()) {}

  async createVideoUrl(objectKey: string) {
    const expiresIn = 15 * 60;
    return {
      expiresAt: new Date(this.now().getTime() + expiresIn * 1000).toISOString(),
      url: await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucketName, Key: objectKey }), { expiresIn }),
    };
  }

  async readArtifacts(key: string): Promise<LearningArtifacts> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    return JSON.parse(await result.Body!.transformToString()) as LearningArtifacts;
  }

  async readTranscript(key: string): Promise<string> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));
    return result.Body!.transformToString();
  }
}
