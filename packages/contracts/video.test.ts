import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_VIDEO_BYTES,
  canTransitionVideo,
  mediaObjectKey,
  ownerVideoIndexKey,
  validateCreateUploadRequest,
  videoMetadataKey,
} from "./video.ts";

const validRequest = {
  checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  contentType: "video/mp4",
  fileName: "lecture-one.mp4",
  languageCode: "en-US",
  sizeBytes: 128_000_000,
  title: "Introduction to Zero Trust",
};

test("normalizes and accepts a bounded video upload", () => {
  const result = validateCreateUploadRequest({
    ...validRequest,
    fileName: "  lecture-one.mp4  ",
    title: "  Introduction to Zero Trust  ",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.fileName, "lecture-one.mp4");
    assert.equal(result.value.title, "Introduction to Zero Trust");
  }
});

test("rejects unsafe paths, unsupported media, and oversized uploads", () => {
  const result = validateCreateUploadRequest({
    ...validRequest,
    contentType: "application/octet-stream",
    fileName: "../lecture.exe",
    sizeBytes: MAX_VIDEO_BYTES + 1,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      new Set(result.issues.map((issue) => issue.code)),
      new Set(["invalid_content_type", "invalid_file_name", "invalid_size"]),
    );
  }
});

test("defines recoverable but non-skippable processing transitions", () => {
  assert.equal(canTransitionVideo("UPLOADING", "QUEUED"), true);
  assert.equal(canTransitionVideo("FAILED", "QUEUED"), true);
  assert.equal(canTransitionVideo("UPLOADING", "READY"), false);
  assert.equal(canTransitionVideo("READY", "TRANSCRIBING"), false);
});

test("builds owner-isolated object and DynamoDB keys", () => {
  assert.deepEqual(videoMetadataKey("video-123"), {
    PK: "VIDEO#video-123",
    SK: "METADATA",
  });
  assert.deepEqual(
    ownerVideoIndexKey("user-42", "2026-07-15T20:00:00.000Z", "video-123"),
    {
      GSI1PK: "OWNER#user-42",
      GSI1SK: "VIDEO#2026-07-15T20:00:00.000Z#video-123",
    },
  );
  assert.equal(
    mediaObjectKey("user-42", "video-123", "lecture.MP4"),
    "private/user-42/videos/video-123/source.mp4",
  );
});
