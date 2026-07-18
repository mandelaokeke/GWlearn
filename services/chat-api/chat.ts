import type { LectureChatMessage, LectureChatRequest, LectureChatResponse } from "../../packages/contracts/chat.ts";
import type { AuthenticatedActor } from "../upload-api/create-upload.ts";
import type { StoredVideo, VideoReadRepository } from "../video-api/read-videos.ts";

export interface LectureChatStorage {
  readTranscript(key: string): Promise<string>;
}

export interface LectureChatModel {
  answer(input: { messages: LectureChatMessage[]; transcript: string; title: string }): Promise<string>;
  modelId: string;
}

function validatedMessages(input: unknown): LectureChatMessage[] | null {
  if (typeof input !== "object" || input === null || !("messages" in input) || !Array.isArray(input.messages)) return null;
  if (input.messages.length < 1 || input.messages.length > 10) return null;
  const messages = input.messages as unknown[];
  if (!messages.every((message) => {
    if (typeof message !== "object" || message === null) return false;
    const value = message as Record<string, unknown>;
    return (value.role === "user" || value.role === "assistant") && typeof value.content === "string" && value.content.trim().length >= 1 && value.content.trim().length <= 2_000;
  })) return null;
  const result = messages.map((message) => {
    const value = message as LectureChatMessage;
    return { content: value.content.trim(), role: value.role };
  });
  return result.at(-1)?.role === "user" ? result : null;
}

export function createLectureChatUseCase(dependencies: {
  model: LectureChatModel;
  repository: Pick<VideoReadRepository, "findOwnedVideo">;
  storage: LectureChatStorage;
}) {
  return async (actor: AuthenticatedActor | null, videoId: string, input: LectureChatRequest | unknown) => {
    if (!actor?.subject) return { body: { message: "Authentication required" }, statusCode: 401 } as const;
    if (!/^[A-Za-z0-9-]{1,100}$/.test(videoId)) return { body: { message: "Video id is invalid" }, statusCode: 400 } as const;
    const messages = validatedMessages(input);
    if (!messages) return { body: { message: "Send 1–10 messages; the latest must be a question of 2,000 characters or fewer." }, statusCode: 400 } as const;

    const video: StoredVideo | null = await dependencies.repository.findOwnedVideo(actor.subject, videoId);
    if (!video) return { body: { message: "Video not found" }, statusCode: 404 } as const;
    if (video.status !== "READY") return { body: { message: "This lecture is still being processed." }, statusCode: 409 } as const;
    const transcriptKey = video.transcriptMarkdownKey ?? video.transcriptTextKey;
    if (!transcriptKey) return { body: { message: "This lecture does not have a transcript yet." }, statusCode: 409 } as const;

    const transcript = await dependencies.storage.readTranscript(transcriptKey);
    if (!transcript.trim()) return { body: { message: "This lecture's transcript is empty." }, statusCode: 409 } as const;
    const answer = await dependencies.model.answer({
      messages,
      title: video.title,
      transcript: transcript.slice(0, 180_000),
    });
    return {
      body: { answer, modelId: dependencies.model.modelId, videoId } satisfies LectureChatResponse,
      statusCode: 200,
    } as const;
  };
}
