import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { hashBlobSha256, requestUploadGrant } from "./direct-upload.ts";

test("hashes upload bytes incrementally into S3-compatible base64 SHA-256", async () => {
  const value = "GWLearn direct upload";
  const progress: number[] = [];
  const checksum = await hashBlobSha256(
    new Blob([value]),
    (current) => progress.push(current),
  );

  assert.equal(checksum, createHash("sha256").update(value).digest("base64"));
  assert.deepEqual(progress, [1]);
});

test("requests an authenticated grant without sending an owner identifier", async () => {
  let body: Record<string, unknown> | undefined;
  let authorization = "";
  const result = await requestUploadGrant({
    accessToken: "verified-access-token",
    apiUrl: "https://api.example.com",
    metadata: {
      checksumSha256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      contentType: "video/mp4",
      fileName: "lecture.mp4",
      languageCode: "en-US",
      sizeBytes: 128,
      title: "Zero Trust",
    },
    request: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(
        JSON.stringify({
          expiresAt: "2026-07-17T22:15:00.000Z",
          fields: { key: "private/user/video/source.mp4" },
          method: "POST",
          objectKey: "private/user/video/source.mp4",
          url: "https://bucket.example.com",
          videoId: "video-123",
        }),
        { status: 201 },
      );
    },
  });

  assert.equal(authorization, "Bearer verified-access-token");
  assert.equal("ownerId" in (body ?? {}), false);
  assert.equal(result.videoId, "video-123");
});
