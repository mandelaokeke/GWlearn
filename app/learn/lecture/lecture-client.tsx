"use client";

import { useEffect, useMemo, useState } from "react";
import { browserAWSConfig, type BrowserAWSConfigInput } from "../../../packages/browser/aws-config";
import { restoreSession } from "../../../packages/browser/cognito-auth";
import { getVideo } from "../../../packages/browser/library-api";
import type { LectureDetail } from "../../../packages/contracts/library";

type Tool = "summary" | "guide" | "flashcards" | "transcript";
function markdownSections(markdown: string) {
  const sections = markdown.split(/\n(?=## )/).filter((section) => section.startsWith("## ")).map((section) => {
    const [heading, ...body] = section.split("\n");
    return { time: heading.replace(/^## /, ""), text: body.join("\n").trim() };
  });
  if (sections.length > 0) return sections;
  return markdown.split("\n").map((line) => /^\[([^\]]+)\]\s*(.*)$/.exec(line)).filter((match): match is RegExpExecArray => Boolean(match)).map((match) => ({ time: match[1], text: match[2] }));
}

export function LectureClient({ configurationInput }: { configurationInput: BrowserAWSConfigInput }) {
  const configuration = useMemo(() => browserAWSConfig(configurationInput), [configurationInput]);
  const [lecture, setLecture] = useState<LectureDetail | null>(null);
  const [tool, setTool] = useState<Tool>("summary");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const videoId = new URLSearchParams(window.location.search).get("videoId");
    if (!videoId || !configuration.configured) { window.location.replace("/learn/library"); return; }
    restoreSession(configuration.value).then((session) => session && getVideo(configuration.value.apiUrl, session.accessToken, videoId)).then((value) => value && setLecture(value)).catch((error) => setMessage(error instanceof Error ? error.message : "The lecture could not be loaded."));
  }, [configuration]);

  if (message) return <div className="library-state"><h2>Lecture unavailable</h2><p>{message}</p><a className="app-primary-link" href="/learn/library">Back to library</a></div>;
  if (!lecture) return <div className="library-state"><span className="app-loader" /><p>Opening your lecture…</p></div>;
  const ready = lecture.status === "READY";
  const transcript = lecture.transcriptMarkdown ? markdownSections(lecture.transcriptMarkdown) : [];

  return <section className="app-page lecture-workspace-page"><div className="app-page-heading"><div><p className="app-kicker">{lecture.languageCode}</p><h1>{lecture.title}</h1><p>{ready ? "Transcript and learning materials ready" : `Processing status: ${lecture.status.toLowerCase()}`}</p></div><span className={`ready-pill lecture-status-${lecture.status.toLowerCase()}`}>{ready ? "Processing complete" : lecture.status}</span></div><div className="lecture-workspace"><div className="lecture-player">{lecture.videoUrl ? <video className="lecture-video" controls preload="metadata" src={lecture.videoUrl}>Your browser cannot play this video.</video> : <div className="player-screen"><span>PRIVATE LECTURE</span><h2>{lecture.title}</h2></div>}<div className="learning-output">{!ready && <><p className="app-kicker">WORKFLOW IN PROGRESS</p><h2>GWLearn is preparing this lecture.</h2><p>Return to the library while Amazon Transcribe and Bedrock finish. The page will become available when its status is Ready.</p></>}{ready && tool === "summary" && <><p className="app-kicker">AI SUMMARY</p><h2>Lecture summary</h2><p>{lecture.artifacts?.summary}</p></>}{ready && tool === "guide" && <><p className="app-kicker">STUDY GUIDE</p><h2>Review questions and ideas</h2><ol>{lecture.artifacts?.studyGuide.map((item) => <li key={item}>{item}</li>)}</ol></>}{ready && tool === "flashcards" && <><p className="app-kicker">FLASHCARDS</p><h2>Practice recall</h2><div className="flashcard-grid">{lecture.artifacts?.flashcards.map((card) => <details key={card.question}><summary>{card.question}</summary><p>{card.answer}</p></details>)}</div></>}{ready && tool === "transcript" && <><p className="app-kicker">MARKDOWN TRANSCRIPT</p><h2>Timestamped source</h2><div className="markdown-transcript">{transcript.map((line) => <section key={`${line.time}-${line.text}`}><h3>{line.time}</h3><p>{line.text}</p></section>)}</div></>}</div></div><aside className="lecture-transcript"><div><p className="app-kicker">LEARNING MATERIALS</p><h2>Work with the source</h2></div>{transcript.slice(0, 5).map((line, index) => <button className={index === 0 ? "active" : ""} type="button" key={`${line.time}-${index}`} onClick={() => setTool("transcript")}><span>{line.time}</span><p>{line.text}</p></button>)}<div className="study-tools"><span>STUDY TOOLS</span><button className={tool === "summary" ? "active" : ""} disabled={!ready} type="button" onClick={() => setTool("summary")}>Summary</button><button className={tool === "guide" ? "active" : ""} disabled={!ready} type="button" onClick={() => setTool("guide")}>Study guide</button><button className={tool === "flashcards" ? "active" : ""} disabled={!ready} type="button" onClick={() => setTool("flashcards")}>Flashcards</button><button className={tool === "transcript" ? "active" : ""} disabled={!ready} type="button" onClick={() => setTool("transcript")}>Transcript</button></div></aside></div></section>;
}
