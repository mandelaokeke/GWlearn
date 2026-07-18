"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { browserAWSConfig, type BrowserAWSConfigInput } from "../../../packages/browser/aws-config";
import { restoreSession } from "../../../packages/browser/cognito-auth";
import { listVideos } from "../../../packages/browser/library-api";
import type { LibraryVideo } from "../../../packages/contracts/library";

const activeStatuses = new Set(["UPLOADING", "QUEUED", "TRANSCRIBING", "GENERATING"]);
function statusLabel(status: string) { return status.toLowerCase().replace(/^./, (value) => value.toUpperCase()); }

export function LibraryClient({ configurationInput }: { configurationInput: BrowserAWSConfigInput }) {
  const configuration = useMemo(() => browserAWSConfig(configurationInput), [configurationInput]);
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!configuration.configured) return;
    const session = await restoreSession(configuration.value);
    if (!session) return;
    try {
      const result = await listVideos(configuration.value.apiUrl, session.accessToken);
      setVideos(result.videos);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The lecture library could not be loaded.");
    } finally { setLoading(false); }
  }, [configuration]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);
  useEffect(() => {
    if (!videos.some((video) => activeStatuses.has(video.status))) return;
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [load, videos]);

  if (loading) return <div className="library-state"><span className="app-loader" /><p>Loading your lectures…</p></div>;
  if (message) return <div className="library-state"><h2>We could not load your library.</h2><p>{message}</p><button type="button" onClick={() => void load()}>Try again</button></div>;
  if (videos.length === 0) return <div className="library-state"><h2>Your library is ready for its first lecture.</h2><p>Upload a recording and it will appear here while Transcribe and Bedrock work.</p><a className="app-primary-link" href="/learn/upload">Upload a video</a></div>;

  return <div className="lecture-library">{videos.map((video, index) => <a className="lecture-card" href={`/learn/lecture?videoId=${encodeURIComponent(video.videoId)}`} key={video.videoId}><div className={`lecture-thumb lecture-thumb-${index % 3 + 1}`}><span>{video.languageCode}</span><b>{video.status === "READY" ? "▶" : "•••"}</b><small>{(video.sizeBytes / 1024 / 1024).toFixed(1)} MB</small></div><div><span className={`lecture-status lecture-status-${video.status.toLowerCase()}`}>{statusLabel(video.status)}</span><h2>{video.title}</h2><p>{new Date(video.createdAt).toLocaleDateString()} · {video.fileName}</p></div></a>)}</div>;
}
