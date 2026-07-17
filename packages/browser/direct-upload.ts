import { createSHA256 } from "hash-wasm";
import type {
  AllowedVideoContentType,
  CreateUploadRequest,
  UploadGrant,
} from "../contracts/video.ts";

const hashChunkBytes = 8 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const batchSize = 0x8000;
  for (let index = 0; index < bytes.length; index += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + batchSize));
  }
  return btoa(binary);
}

export async function hashBlobSha256(
  blob: Blob,
  onProgress: (progress: number) => void = () => undefined,
): Promise<string> {
  const hasher = await createSHA256();
  if (blob.size === 0) onProgress(1);

  for (let offset = 0; offset < blob.size; offset += hashChunkBytes) {
    const chunk = blob.slice(offset, Math.min(offset + hashChunkBytes, blob.size));
    hasher.update(new Uint8Array(await chunk.arrayBuffer()));
    onProgress(Math.min(1, (offset + chunk.size) / blob.size));
  }

  return bytesToBase64(hasher.digest("binary"));
}

export async function requestUploadGrant(input: {
  accessToken: string;
  apiUrl: string;
  metadata: CreateUploadRequest;
  request?: typeof fetch;
}): Promise<UploadGrant> {
  const response = await (input.request ?? fetch)(`${input.apiUrl}/uploads`, {
    body: JSON.stringify(input.metadata),
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json().catch(() => null)) as
    | UploadGrant
    | { message?: string }
    | null;
  if (!response.ok) {
    throw new Error(
      body && "message" in body && body.message
        ? body.message
        : "GWLearn could not prepare this upload.",
    );
  }
  return body as UploadGrant;
}

export function postFileToGrant(
  grant: UploadGrant,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(grant.fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);

    const request = new XMLHttpRequest();
    request.open(grant.method, grant.url);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      reject(new Error("The private media upload did not complete."));
    });
    request.addEventListener("error", () =>
      reject(new Error("The media upload was interrupted.")),
    );
    request.send(form);
  });
}

export function allowedContentType(file: File): AllowedVideoContentType | null {
  if (
    file.type === "video/mp4" ||
    file.type === "video/quicktime" ||
    file.type === "video/webm"
  ) {
    return file.type;
  }
  return null;
}
