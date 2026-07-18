import type {
  LectureDetail,
  LearningArtifacts,
  LibraryVideo,
  VideoLibraryResponse,
} from "../../packages/contracts/library.ts";
import type { AuthenticatedActor } from "../upload-api/create-upload.ts";

export interface StoredVideo extends LibraryVideo {
  artifactKey?: string;
  objectKey: string;
  ownerId: string;
  transcriptMarkdownKey?: string;
  transcriptTextKey?: string;
}

export interface VideoReadRepository {
  findOwnedVideo(ownerId: string, videoId: string): Promise<StoredVideo | null>;
  listOwnedVideos(ownerId: string): Promise<StoredVideo[]>;
}

export interface VideoReadStorage {
  createVideoUrl(objectKey: string): Promise<{ expiresAt: string; url: string }>;
  readArtifacts(key: string): Promise<LearningArtifacts>;
  readTranscript(key: string): Promise<string>;
}

function publicVideo(video: StoredVideo): LibraryVideo {
  return {
    createdAt: video.createdAt,
    fileName: video.fileName,
    languageCode: video.languageCode,
    sizeBytes: video.sizeBytes,
    status: video.status,
    title: video.title,
    updatedAt: video.updatedAt,
    videoId: video.videoId,
  };
}

export function createVideoReadUseCase(dependencies: {
  repository: VideoReadRepository;
  storage: VideoReadStorage;
}) {
  return {
    async get(actor: AuthenticatedActor | null, videoId: string) {
      if (!actor?.subject) return { body: { message: "Authentication required" }, statusCode: 401 } as const;
      if (!/^[A-Za-z0-9-]{1,100}$/.test(videoId)) return { body: { message: "Video id is invalid" }, statusCode: 400 } as const;
      const video = await dependencies.repository.findOwnedVideo(actor.subject, videoId);
      if (!video) return { body: { message: "Video not found" }, statusCode: 404 } as const;

      let artifacts: LearningArtifacts | null = null;
      let transcriptMarkdown: string | null = null;
      let videoUrl: string | null = null;
      let videoUrlExpiresAt: string | null = null;
      if (video.status === "READY") {
        const transcriptKey = video.transcriptMarkdownKey ?? video.transcriptTextKey;
        [artifacts, transcriptMarkdown] = await Promise.all([
          video.artifactKey ? dependencies.storage.readArtifacts(video.artifactKey) : Promise.resolve(null),
          transcriptKey ? dependencies.storage.readTranscript(transcriptKey) : Promise.resolve(null),
        ]);
      }
      const playback = await dependencies.storage.createVideoUrl(video.objectKey);
      videoUrl = playback.url;
      videoUrlExpiresAt = playback.expiresAt;
      return { body: { ...publicVideo(video), artifacts, transcriptMarkdown, videoUrl, videoUrlExpiresAt } satisfies LectureDetail, statusCode: 200 } as const;
    },
    async list(actor: AuthenticatedActor | null) {
      if (!actor?.subject) return { body: { message: "Authentication required" }, statusCode: 401 } as const;
      const stored = await dependencies.repository.listOwnedVideos(actor.subject);
      const videos = stored.map(publicVideo);
      return { body: { videos } satisfies VideoLibraryResponse, statusCode: 200 } as const;
    },
  };
}
