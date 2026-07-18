import type { LectureDetail, VideoLibraryResponse } from "../contracts/library.ts";

async function authenticatedJson<T extends object>(url: string, accessToken: string, request: typeof fetch = fetch): Promise<T> {
  const response = await request(url, { headers: { authorization: `Bearer ${accessToken}` } });
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
