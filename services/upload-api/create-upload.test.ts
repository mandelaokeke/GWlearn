import assert from "node:assert/strict";
import test from "node:test";
import {
  createUploadUseCase,
  type PendingVideo,
  type UploadRepository,
  type UploadStorage,
} from "./create-upload.ts";

const request = {
  checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  contentType: "video/mp4",
  fileName: "lecture.mp4",
  languageCode: "en-US",
  sizeBytes: 256_000,
  title: "Security Architecture",
};

function createHarness(storageFailure = false, repositoryFailure = false) {
  const created: PendingVideo[] = [];
  const deleted: Array<{ ownerId: string; videoId: string }> = [];

  const repository: UploadRepository = {
    async createPendingVideo(video) {
      if (repositoryFailure) throw new Error("conditional write rejected");
      created.push(video);
    },
    async deletePendingVideo(videoId, ownerId) {
      deleted.push({ ownerId, videoId });
    },
  };

  const storage: UploadStorage = {
    async createUploadGrant(input) {
      if (storageFailure) throw new Error("S3 unavailable");
      return {
        fields: {
          "Content-Type": input.contentType,
          "x-amz-checksum-sha256": input.checksumSha256,
        },
        method: "POST",
        objectKey: input.objectKey,
        url: "https://uploads.example.test",
        videoId: input.videoId,
      };
    },
  };

  const execute = createUploadUseCase({
    clock: { now: () => new Date("2026-07-15T20:00:00.000Z") },
    ids: { create: () => "video-123" },
    repository,
    storage,
  });

  return { created, deleted, execute };
}

test("rejects anonymous upload creation", async () => {
  const { execute } = createHarness();
  const result = await execute(null, request);

  assert.deepEqual(result, {
    body: { message: "Authentication required" },
    statusCode: 401,
  });
});

test("persists an owner-scoped pending video before issuing the grant", async () => {
  const { created, execute } = createHarness();
  const result = await execute(
    { groups: ["students"], subject: "user-42" },
    request,
  );

  assert.equal(result.statusCode, 201);
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], {
    checksumSha256: request.checksumSha256,
    contentType: "video/mp4",
    createdAt: "2026-07-15T20:00:00.000Z",
    fileName: "lecture.mp4",
    gsi1pk: "OWNER#user-42",
    gsi1sk: "VIDEO#2026-07-15T20:00:00.000Z#video-123",
    languageCode: "en-US",
    objectKey: "private/user-42/videos/video-123/source.mp4",
    ownerId: "user-42",
    pk: "VIDEO#video-123",
    sizeBytes: 256_000,
    sk: "METADATA",
    status: "UPLOADING",
    title: "Security Architecture",
    updatedAt: "2026-07-15T20:00:00.000Z",
    videoId: "video-123",
  });

  if (result.statusCode === 201) {
    assert.equal(result.body.videoId, "video-123");
    assert.equal(result.body.expiresAt, "2026-07-15T20:15:00.000Z");
    assert.equal(
      result.body.fields["x-amz-checksum-sha256"],
      request.checksumSha256,
    );
  }
});

test("compensates for storage-grant failure without leaking provider errors", async () => {
  const { deleted, execute } = createHarness(true);
  const result = await execute(
    { groups: ["faculty"], subject: "user-42" },
    request,
  );

  assert.deepEqual(result, {
    body: { message: "Unable to prepare the upload" },
    statusCode: 500,
  });
  assert.deepEqual(deleted, [{ ownerId: "user-42", videoId: "video-123" }]);
});

test("does not delete a pre-existing record when the conditional create fails", async () => {
  const { deleted, execute } = createHarness(false, true);
  const result = await execute(
    { groups: ["students"], subject: "user-42" },
    request,
  );

  assert.equal(result.statusCode, 500);
  assert.deepEqual(deleted, []);
});
