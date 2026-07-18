import assert from "node:assert/strict";
import test from "node:test";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { PipelineController, parseSourceEvent } from "./control.ts";

const event = {
  detail: {
    bucket: { name: "gwlearn-media" },
    object: { key: "private/user-42/videos/video-123/source.mp4" },
  },
};

test("parses only owner-scoped source video events", () => {
  assert.deepEqual(parseSourceEvent(event), {
    bucketName: "gwlearn-media",
    mediaFormat: "mp4",
    objectKey: "private/user-42/videos/video-123/source.mp4",
    ownerId: "user-42",
    videoId: "video-123",
  });
  assert.throws(() => parseSourceEvent({
    detail: { bucket: { name: "gwlearn-media" }, object: { key: "public/video.mp4" } },
  }));
});

test("moves a matching upload through queued to transcribing", async () => {
  const commands: unknown[] = [];
  const client = {
    async send(command: unknown) {
      commands.push(command);
      if (command instanceof GetCommand) {
        return {
          Item: {
            languageCode: "en-US",
            objectKey: event.detail.object.key,
            ownerId: "user-42",
            status: "UPLOADING",
          },
        };
      }
      return {};
    },
  };
  const controller = new PipelineController(
    client as never,
    "gwlearn-table",
    { now: () => new Date("2026-07-17T20:00:00.000Z") },
  );

  const result = await controller.initialize(event);
  assert.deepEqual(result, {
    bucketName: "gwlearn-media",
    languageCode: "en-US",
    mediaFormat: "mp4",
    mediaUri: "s3://gwlearn-media/private/user-42/videos/video-123/source.mp4",
    ownerId: "user-42",
    skip: false,
    transcriptKey: "private/user-42/videos/video-123/transcript/transcribe.json",
    transcriptionJobName: "gwlearn-video-123",
    videoId: "video-123",
  });
  assert.equal(commands[0] instanceof GetCommand, true);
  assert.equal(commands[1] instanceof UpdateCommand, true);
  assert.equal(commands[2] instanceof UpdateCommand, true);
  assert.equal((commands[1] as UpdateCommand).input.ConditionExpression, "#status = :current");
});

test("ignores duplicate delivery after processing has started", async () => {
  const client = {
    async send(command: unknown) {
      if (command instanceof GetCommand) {
        return { Item: { languageCode: "en-US", objectKey: event.detail.object.key, ownerId: "user-42", status: "TRANSCRIBING" } };
      }
      throw new Error("duplicate events must not update state");
    },
  };
  const controller = new PipelineController(client as never, "gwlearn-table");
  assert.deepEqual(await controller.initialize(event), {
    reason: "Video is already TRANSCRIBING",
    skip: true,
  });
});

test("failure recording never creates ghost video metadata", async () => {
  let update: UpdateCommand | undefined;
  const controller = new PipelineController({
    async send(command: unknown) {
      update = command as UpdateCommand;
      return {};
    },
  } as never, "gwlearn-table");

  await controller.fail({ error: { Error: "TranscribeFailed" }, videoId: "video-123" });
  assert.equal(update?.input.ConditionExpression, "attribute_exists(PK)");
  assert.deepEqual(update?.input.Key, { PK: "VIDEO#video-123", SK: "METADATA" });
});
