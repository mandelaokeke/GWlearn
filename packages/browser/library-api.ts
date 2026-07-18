import type { LectureDetail, VideoLibraryResponse } from "../contracts/library.ts";
import type { LectureChatRequest, LectureChatResponse } from "../contracts/chat.ts";

async function authenticatedJson<T extends object>(url: string, accessToken: string, request: typeof fetch = fetch, init: RequestInit = {}): Promise<T> {
  const response = await request(url, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, ...init.headers },
  });
  const body = await response.json().catch(() => null) as T | { message?: string } | null;
  if (!response.ok) throw new Error(body && "message" in body && body.message ? body.message : "GWLearn could not load this lecture.");
  return body as T;
}

export function listVideos(apiUrl: string, accessToken: string, request?: typeof fetch) {
  return authenticatedJson<VideoLibraryResponse>(`${apiUrl}/videos`, accessToken, request);
}

export function getVideo(apiUrl: string, accessToken: string, videoId: string, request?: typeof fetch) {
  return authenticatedJson<LectureDetail>(`${apiUrl}/videos/${encodeURIComponent(videoId)}`, accessToken, request);
}

export function chatWithVideo(apiUrl: string, accessToken: string, videoId: string, input: LectureChatRequest, request?: typeof fetch) {
  return authenticatedJson<LectureChatResponse>(`${apiUrl}/videos/${encodeURIComponent(videoId)}/chat`, accessToken, request, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}
