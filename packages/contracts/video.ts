export const VIDEO_STATUSES = [
  "CREATED",
  "UPLOADING",
  "QUEUED",
  "TRANSCRIBING",
  "GENERATING",
  "READY",
  "INVALID",
  "FAILED",
] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const ALLOWED_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type AllowedVideoContentType =
  (typeof ALLOWED_VIDEO_CONTENT_TYPES)[number];

export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export interface CreateUploadRequest {
  checksumSha256: string;
  contentType: AllowedVideoContentType;
  fileName: string;
  languageCode: string;
  sizeBytes: number;
  title: string;
}

export interface UploadGrant {
  expiresAt: string;
  fields: Record<string, string>;
  method: "POST";
  objectKey: string;
  url: string;
  videoId: string;
}

export interface ContractIssue {
  code:
    | "invalid_checksum"
    | "invalid_content_type"
    | "invalid_file_name"
    | "invalid_language_code"
    | "invalid_size"
    | "invalid_title"
    | "required";
  field: keyof CreateUploadRequest;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { issues: ContractIssue[]; ok: false };

const contentTypeSet = new Set<string>(ALLOWED_VIDEO_CONTENT_TYPES);
const checksumPattern = /^[A-Za-z0-9+/]{43}=$/;
const languageCodePattern = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  input: Record<string, unknown>,
  field: keyof CreateUploadRequest,
  issues: ContractIssue[],
): string | null {
  const value = input[field];
  if (typeof value !== "string" || value.trim() === "") {
    issues.push({ code: "required", field, message: `${field} is required` });
    return null;
  }

  return value.trim();
}

export function validateCreateUploadRequest(
  input: unknown,
): ValidationResult<CreateUploadRequest> {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "required",
          field: "title",
          message: "request body must be a JSON object",
        },
      ],
    };
  }

  const issues: ContractIssue[] = [];
  const title = stringField(input, "title", issues);
  const fileName = stringField(input, "fileName", issues);
  const contentType = stringField(input, "contentType", issues);
  const checksumSha256 = stringField(input, "checksumSha256", issues);
  const languageCode = stringField(input, "languageCode", issues);
  const sizeBytes = input.sizeBytes;

  if (title && title.length > 120) {
    issues.push({
      code: "invalid_title",
      field: "title",
      message: "title must be 120 characters or fewer",
    });
  }

  if (
    fileName &&
    (fileName.length > 255 ||
      fileName.includes("/") ||
      fileName.includes("\\") ||
      fileName === "." ||
      fileName === "..")
  ) {
    issues.push({
      code: "invalid_file_name",
      field: "fileName",
      message: "fileName must be a plain file name without path segments",
    });
  }

  if (contentType && !contentTypeSet.has(contentType)) {
    issues.push({
      code: "invalid_content_type",
      field: "contentType",
      message: `contentType must be one of ${ALLOWED_VIDEO_CONTENT_TYPES.join(", ")}`,
    });
  }

  if (checksumSha256 && !checksumPattern.test(checksumSha256)) {
    issues.push({
      code: "invalid_checksum",
      field: "checksumSha256",
      message: "checksumSha256 must be a base64-encoded SHA-256 checksum",
    });
  }

  if (languageCode && !languageCodePattern.test(languageCode)) {
    issues.push({
      code: "invalid_language_code",
      field: "languageCode",
      message: "languageCode must look like en or en-US",
    });
  }

  if (
    typeof sizeBytes !== "number" ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_VIDEO_BYTES
  ) {
    issues.push({
      code: "invalid_size",
      field: "sizeBytes",
      message: `sizeBytes must be a positive integer no larger than ${MAX_VIDEO_BYTES}`,
    });
  }

  if (
    issues.length > 0 ||
    !title ||
    !fileName ||
    !contentType ||
    !checksumSha256 ||
    !languageCode ||
    typeof sizeBytes !== "number"
  ) {
    return { issues, ok: false };
  }

  return {
    ok: true,
    value: {
      checksumSha256,
      contentType: contentType as AllowedVideoContentType,
      fileName,
      languageCode,
      sizeBytes,
      title,
    },
  };
}

const allowedTransitions: Readonly<Record<VideoStatus, readonly VideoStatus[]>> = {
  CREATED: ["UPLOADING", "INVALID"],
  UPLOADING: ["QUEUED", "INVALID", "FAILED"],
  QUEUED: ["TRANSCRIBING", "FAILED"],
  TRANSCRIBING: ["GENERATING", "FAILED"],
  GENERATING: ["READY", "FAILED"],
  READY: [],
  INVALID: [],
  FAILED: ["QUEUED"],
};

export function canTransitionVideo(
  current: VideoStatus,
  next: VideoStatus,
): boolean {
  return allowedTransitions[current].includes(next);
}

export function videoMetadataKey(videoId: string) {
  return { PK: `VIDEO#${videoId}`, SK: "METADATA" } as const;
}

export function ownerVideoIndexKey(
  ownerId: string,
  createdAt: string,
  videoId: string,
) {
  return {
    GSI1PK: `OWNER#${ownerId}`,
    GSI1SK: `VIDEO#${createdAt}#${videoId}`,
  } as const;
}

export function mediaObjectKey(ownerId: string, videoId: string, fileName: string) {
  const extension = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : "";
  return `private/${ownerId}/videos/${videoId}/source${extension}`;
}
