"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { browserAWSConfig, type BrowserAWSConfigInput } from "../../../packages/browser/aws-config";
import { restoreSession } from "../../../packages/browser/cognito-auth";
import { chatWithVideo, listVideos } from "../../../packages/browser/library-api";
import type { LectureChatMessage } from "../../../packages/contracts/chat";
import type { LibraryVideo } from "../../../packages/contracts/library";

export function ChatClient({ configurationInput }: { configurationInput: BrowserAWSConfigInput }) {
  const configuration = useMemo(() => browserAWSConfig(configurationInput), [configurationInput]);
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<LectureChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!configuration.configured) return setLoading(false);
      const session = await restoreSession(configuration.value);
      if (!session) return setLoading(false);
      try {
        const result = await listVideos(configuration.value.apiUrl, session.accessToken);
        const ready = result.videos.filter((video) => video.status === "READY");
        setVideos(ready);
        setSelectedId(ready[0]?.videoId ?? "");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your lectures could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [configuration]);

  const selected = videos.find((video) => video.videoId === selectedId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content || !selected || !configuration.configured || sending) return;
    const userMessage: LectureChatMessage = { content, role: "user" };
    const conversation = [...messages, userMessage].slice(-10);
    setMessages(conversation);
    setQuestion("");
    setSending(true);
    setError("");
    try {
      const session = await restoreSession(configuration.value);
      if (!session) throw new Error("Your session expired. Please sign in again.");
      const result = await chatWithVideo(configuration.value.apiUrl, session.accessToken, selected.videoId, { messages: conversation });
      const assistantMessage: LectureChatMessage = { content: result.answer, role: "assistant" };
      setMessages((current) => [...current, assistantMessage].slice(-10));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GWLearn could not answer that question.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="library-state"><span className="app-loader" /><p>Loading your processed lectures…</p></div>;
  if (!selected) return <div className="library-state"><h2>Process a lecture to start chatting.</h2><p>Once a video has a transcript, Bedrock can answer questions using that lecture as its source.</p><a className="app-primary-link" href="/learn/upload">Upload a video</a></div>;

  return <div className="chat-workspace">
    <aside>
      <label className="chat-lecture-label" htmlFor="chat-lecture">Selected lecture</label>
      <select id="chat-lecture" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessages([]); setError(""); }}>
        {videos.map((video) => <option key={video.videoId} value={video.videoId}>{video.title}</option>)}
      </select>
      <h2>{selected.title}</h2>
      <p>{selected.fileName} · {selected.languageCode}</p>
      <a href={`/learn/lecture?videoId=${encodeURIComponent(selected.videoId)}`}>View transcript source →</a>
      <div className="chat-grounding"><b>Amazon Bedrock</b><span>Answers are grounded in this transcript.</span></div>
    </aside>
    <div className="chat-thread">
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 ? <div className="chat-empty"><span>GW</span><h2>Ask this lecture anything.</h2><p>Answers stay grounded in the transcript and point back to available timestamps.</p></div> : messages.map((message, index) => <div className={`chat-message chat-message-${message.role}`} key={`${index}-${message.content.slice(0, 20)}`}><span>{message.role === "user" ? "You" : "GWLearn"}</span><p>{message.content}</p></div>)}
        {sending ? <div className="chat-message chat-message-assistant chat-thinking"><span>GWLearn</span><p>Reading the lecture transcript…</p></div> : null}
      </div>
      {error ? <p className="chat-error" role="alert">{error}</p> : null}
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-question">Question</label>
        <input id="chat-question" maxLength={2000} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question about this lecture…" value={question} />
        <button disabled={sending || !question.trim()} type="submit">{sending ? "Thinking…" : "Send"}</button>
      </form>
    </div>
  </div>;
}
