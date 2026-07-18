import type { VideoStatus } from "./video.ts";

export interface LibraryVideo {
  createdAt: string;
  fileName: string;
  languageCode: string;
  sizeBytes: number;
  status: VideoStatus;
  title: string;
  updatedAt: string;
  videoId: string;
}

export interface LearningArtifacts {
  flashcards: Array<{ answer: string; question: string }>;
  generatedAt?: string;
  modelId?: string;
  studyGuide: string[];
  summary: string;
}

export interface LectureDetail extends LibraryVideo {
  artifacts: LearningArtifacts | null;
  transcriptMarkdown: string | null;
  videoUrl: string | null;
  videoUrlExpiresAt: string | null;
}

export interface VideoLibraryResponse { videos: LibraryVideo[] }
