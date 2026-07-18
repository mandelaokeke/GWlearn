import assert from "node:assert/strict";
import test from "node:test";
import type { StoredVideo } from "../video-api/read-videos.ts";
import { createLectureChatUseCase } from "./chat.ts";

const video: StoredVideo = {
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

function chat(stored: StoredVideo | null = video) {
  let modelInput: { transcript: string } | null = null;
  const useCase = createLectureChatUseCase({
    model: {
      answer: async (input) => {
        modelInput = input;
        return "Every request is verified [00:02].";
      },
      modelId: "amazon.nova-lite-v1:0",
    },
    repository: { findOwnedVideo: async (ownerId) => stored?.ownerId === ownerId ? stored : null },
    storage: { readTranscript: async () => "# Lecture transcript\n\n## 00:02\n\nVerify every request." },
  });
  return { modelInput: () => modelInput, useCase };
}

test("answers an owned ready lecture using its transcript", async () => {
  const fixture = chat();
  const result = await fixture.useCase({ groups: [], subject: "user-1" }, "video-1", { messages: [{ content: "What is verified?", role: "user" }] });
  assert.equal(result.statusCode, 200);
  assert.match("answer" in result.body ? result.body.answer : "", /\[00:02\]/);
  assert.match(fixture.modelInput()?.transcript ?? "", /Verify every request/);
});

test("does not reveal or invoke Bedrock for another owner's lecture", async () => {
  const fixture = chat();
  const result = await fixture.useCase({ groups: [], subject: "user-2" }, "video-1", { messages: [{ content: "Summarize it", role: "user" }] });
  assert.equal(result.statusCode, 404);
  assert.equal(fixture.modelInput(), null);
});

test("waits for processing before allowing chat", async () => {
  const fixture = chat({ ...video, status: "TRANSCRIBING" });
  const result = await fixture.useCase({ groups: [], subject: "user-1" }, "video-1", { messages: [{ content: "Summarize it", role: "user" }] });
  assert.equal(result.statusCode, 409);
});

test("rejects oversized or assistant-final conversations", async () => {
  const fixture = chat();
  const result = await fixture.useCase({ groups: [], subject: "user-1" }, "video-1", { messages: [{ content: "Not a question", role: "assistant" }] });
  assert.equal(result.statusCode, 400);
});
