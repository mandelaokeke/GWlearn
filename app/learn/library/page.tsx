import type { Metadata } from "next";
import { awsRuntimeConfig } from "../../aws-runtime-config";
import { LibraryClient } from "./library-client";

export const metadata: Metadata = { title: "Browse videos" };
export default function LibraryPage() {
  return <section className="app-page"><div className="app-page-heading"><div><p className="app-kicker">LECTURE LIBRARY</p><h1>Browse videos</h1><p>Your uploads appear here immediately and update as transcription and study-material generation progress.</p></div><a className="app-primary-link" href="/learn/upload">Upload new video</a></div><LibraryClient configurationInput={awsRuntimeConfig()} /></section>;
}
