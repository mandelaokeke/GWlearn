import {
  MAX_VIDEO_BYTES,
  mediaObjectKey,
  ownerVideoIndexKey,
  validateCreateUploadRequest,
  videoMetadataKey,
  type AllowedVideoContentType,
  type ContractIssue,
  type UploadGrant,
} from "../../packages/contracts/video.ts";

export interface AuthenticatedActor {
  groups: readonly string[];
  subject: string;
}

export interface PendingVideo {
  checksumSha256: string;
  contentType: AllowedVideoContentType;
  createdAt: string;
  fileName: string;
  gsi1pk: string;
  gsi1sk: string;
  languageCode: string;
  objectKey: string;
  ownerId: string;
  pk: string;
  sizeBytes: number;
  sk: string;
  status: "UPLOADING";
  title: string;
  updatedAt: string;
  videoId: string;
}

export interface UploadRepository {
  createPendingVideo(video: PendingVideo): Promise<void>;
  deletePendingVideo(videoId: string, ownerId: string): Promise<void>;
}

export interface UploadStorage {
  createUploadGrant(input: {
    checksumSha256: string;
    contentType: AllowedVideoContentType;
    expiresInSeconds: number;
    maxBytes: number;
    objectKey: string;
    videoId: string;
  }): Promise<Omit<UploadGrant, "expiresAt">>;
}

export interface CreateUploadDependencies {
  clock: { now(): Date };
  ids: { create(): string };
  repository: UploadRepository;
  storage: UploadStorage;
}

export type CreateUploadResult =
  | { body: { issues: ContractIssue[]; message: string }; statusCode: 400 }
  | { body: { message: string }; statusCode: 401 | 500 }
  | { body: UploadGrant; statusCode: 201 };

const uploadGrantLifetimeSeconds = 15 * 60;

export function createUploadUseCase(dependencies: CreateUploadDependencies) {
  return async function createUpload(
    actor: AuthenticatedActor | null,
    input: unknown,
  ): Promise<CreateUploadResult> {
    if (!actor?.subject) {
      return { body: { message: "Authentication required" }, statusCode: 401 };
    }

    const parsed = validateCreateUploadRequest(input);
    if (!parsed.ok) {
      return {
        body: { issues: parsed.issues, message: "Upload metadata is invalid" },
        statusCode: 400,
      };
    }

    const videoId = dependencies.ids.create();
    const now = dependencies.clock.now();
    const createdAt = now.toISOString();
    const objectKey = mediaObjectKey(
      actor.subject,
      videoId,
      parsed.value.fileName,
    );
    const primaryKey = videoMetadataKey(videoId);
    const ownerKey = ownerVideoIndexKey(actor.subject, createdAt, videoId);

    const pendingVideo: PendingVideo = {
      checksumSha256: parsed.value.checksumSha256,
      contentType: parsed.value.contentType,
      createdAt,
      fileName: parsed.value.fileName,
      gsi1pk: ownerKey.GSI1PK,
      gsi1sk: ownerKey.GSI1SK,
      languageCode: parsed.value.languageCode,
      objectKey,
      ownerId: actor.subject,
      pk: primaryKey.PK,
      sizeBytes: parsed.value.sizeBytes,
      sk: primaryKey.SK,
      status: "UPLOADING",
      title: parsed.value.title,
      updatedAt: createdAt,
      videoId,
    };

    try {
      await dependencies.repository.createPendingVideo(pendingVideo);

      const grant = await dependencies.storage.createUploadGrant({
        checksumSha256: parsed.value.checksumSha256,
        contentType: parsed.value.contentType,
        expiresInSeconds: uploadGrantLifetimeSeconds,
        maxBytes: Math.min(parsed.value.sizeBytes, MAX_VIDEO_BYTES),
        objectKey,
        videoId,
      });

      return {
        body: {
          ...grant,
          expiresAt: new Date(
            now.getTime() + uploadGrantLifetimeSeconds * 1000,
          ).toISOString(),
        },
        statusCode: 201,
      };
    } catch {
      await dependencies.repository
        .deletePendingVideo(videoId, actor.subject)
        .catch(() => undefined);

      return {
        body: { message: "Unable to prepare the upload" },
        statusCode: 500,
      };
    }
  };
}
