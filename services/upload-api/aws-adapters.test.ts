import assert from "node:assert/strict";
import test from "node:test";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoUploadRepository, S3UploadStorage } from "./aws-adapters.ts";
import type { PendingVideo } from "./create-upload.ts";

const pendingVideo: PendingVideo = {
  checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  contentType: "video/mp4",
  createdAt: "2026-07-17T18:00:00.000Z",
  fileName: "lecture.mp4",
  gsi1pk: "OWNER#user-42",
  gsi1sk: "VIDEO#2026-07-17T18:00:00.000Z#video-123",
  languageCode: "en-US",
  objectKey: "private/user-42/videos/video-123/source.mp4",
  ownerId: "user-42",
  pk: "VIDEO#video-123",
  sizeBytes: 256_000,
  sk: "METADATA",
  status: "UPLOADING",
  title: "Security Architecture",
  updatedAt: "2026-07-17T18:00:00.000Z",
  videoId: "video-123",
};

test("writes owner-indexed metadata conditionally and deletes only for its owner", async () => {
  const commands: unknown[] = [];
  const client = { async send(command: unknown) { commands.push(command); } };
  const repository = new DynamoUploadRepository(
    client as DynamoDBDocumentClient,
    "gwlearn-test",
  );

  await repository.createPendingVideo(pendingVideo);
  await repository.deletePendingVideo("video-123", "user-42");

  assert.equal(commands[0] instanceof PutCommand, true);
  assert.deepEqual((commands[0] as PutCommand).input, {
    ConditionExpression: "attribute_not_exists(PK)",
    Item: {
      checksumSha256: pendingVideo.checksumSha256,
      contentType: "video/mp4",
      createdAt: pendingVideo.createdAt,
      entityType: "VIDEO",
      fileName: "lecture.mp4",
      GSI1PK: "OWNER#user-42",
      GSI1SK: pendingVideo.gsi1sk,
      languageCode: "en-US",
      objectKey: pendingVideo.objectKey,
      ownerId: "user-42",
      PK: "VIDEO#video-123",
      sizeBytes: 256_000,
      SK: "METADATA",
      status: "UPLOADING",
      title: "Security Architecture",
      updatedAt: pendingVideo.updatedAt,
      videoId: "video-123",
    },
    TableName: "gwlearn-test",
  });
  assert.equal(commands[1] instanceof DeleteCommand, true);
  assert.equal(
    (commands[1] as DeleteCommand).input.ConditionExpression,
    "ownerId = :ownerId",
  );
});

test("presigns an exact owner-scoped key with checksum, type, size, and expiry constraints", async () => {
  let options: Record<string, unknown> | undefined;
  const storage = new S3UploadStorage(
    {} as S3Client,
    "gwlearn-media",
    async (_client, received) => {
      options = received as unknown as Record<string, unknown>;
      return {
        fields: { key: received.Key },
        url: "https://gwlearn-media.s3.amazonaws.com",
      };
    },
  );

  const result = await storage.createUploadGrant({
    checksumSha256: pendingVideo.checksumSha256,
    contentType: "video/mp4",
    expiresInSeconds: 900,
    maxBytes: 256_000,
    objectKey: pendingVideo.objectKey,
    videoId: "video-123",
  });

  assert.equal(options?.Bucket, "gwlearn-media");
  assert.equal(options?.Key, pendingVideo.objectKey);
  assert.equal(options?.Expires, 900);
  assert.deepEqual(options?.Conditions, [
    ["content-length-range", 1, 256_000],
    ["eq", "$Content-Type", "video/mp4"],
    ["eq", "$x-amz-checksum-sha256", pendingVideo.checksumSha256],
  ]);
  assert.equal(result.objectKey, pendingVideo.objectKey);
});
