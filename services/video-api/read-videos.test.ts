import assert from "node:assert/strict";
import test from "node:test";
import { createVideoReadUseCase, type StoredVideo } from "./read-videos.ts";

const video: StoredVideo = {
  artifactKey: "private/user-1/videos/video-1/artifacts/learning.json",
  createdAt: "2026-07-18T12:00:00.000Z",
  fileName: "lecture.mp4",
  languageCode: "en-US",
  objectKey: "private/user-1/videos/video-1/source.mp4",
  ownerId: "user-1",
  sizeBytes: 42,
  status: "READY",
  title: "Zero Trust",
  transcriptMarkdownKey: "private/user-1/videos/video-1/transcript/transcript.md",
  updatedAt: "2026-07-18T12:05:00.000Z",
  videoId: "video-1",
};

function useCase(stored: StoredVideo | null = video) {
  return createVideoReadUseCase({
    repository: {
      findOwnedVideo: async (ownerId) => stored?.ownerId === ownerId ? stored : null,
      listOwnedVideos: async (ownerId) => stored?.ownerId === ownerId ? [stored] : [],
    },
    storage: {
      createVideoUrl: async () => ({ expiresAt: "2026-07-18T12:20:00.000Z", url: "https://signed.example/video" }),
      readArtifacts: async () => ({ flashcards: [{ answer: "Verify", question: "What first?" }], studyGuide: ["Review [00:02]"], summary: "Grounded summary" }),
      readTranscript: async () => "# Lecture transcript\n\n## 00:02\n\nVerify every request.",
    },
  });
}

test("lists only the authenticated owner's metadata without storage keys", async () => {
  const result = await useCase().list({ groups: [], subject: "user-1" });
  assert.equal(result.statusCode, 200);
  if ("videos" in result.body) {
    assert.equal(result.body.videos[0]?.title, "Zero Trust");
    assert.equal("objectKey" in result.body.videos[0]!, false);
  }
});

test("returns Markdown, Bedrock artifacts, and temporary playback for an owned ready lecture", async () => {
  const result = await useCase().get({ groups: [], subject: "user-1" }, "video-1");
  assert.equal(result.statusCode, 200);
  if ("transcriptMarkdown" in result.body) {
    assert.match(result.body.transcriptMarkdown ?? "", /^# Lecture transcript/);
    assert.equal(result.body.artifacts?.flashcards.length, 1);
    assert.match(result.body.videoUrl ?? "", /^https:\/\//);
  }
});

test("does not reveal another owner's lecture", async () => {
  const result = await useCase().get({ groups: [], subject: "user-2" }, "video-1");
  assert.equal(result.statusCode, 404);
});
