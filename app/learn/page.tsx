import type { Metadata } from "next";

export const metadata: Metadata = { title: "Learning home" };

export default function LearningHome() {
  return (
    <>
      <section className="app-welcome">
        <div><p className="app-kicker">STUDENT WORKSPACE</p><h1>Welcome to GWLearn.</h1><p>Your lectures, transcripts, and study tools live together here.</p></div>
        <a className="app-primary-link" href="/learn/upload">Upload a lecture <span>→</span></a>
      </section>
      <section className="app-action-grid" aria-label="GWLearn actions">
        <a href="/learn/library"><span className="app-card-number">01</span><h2>Lecture videos</h2><p>Browse recordings and open their learning workspaces.</p><b>Browse library →</b></a>
        <a href="/learn/upload"><span className="app-card-number">02</span><h2>Upload videos</h2><p>Send a recording securely for transcription and study-material generation.</p><b>Start upload →</b></a>
        <a href="/learn/chat"><span className="app-card-number">03</span><h2>Chat with AI</h2><p>Ask questions grounded in the lecture you choose.</p><b>Open chat →</b></a>
      </section>
      <section className="app-recent"><div><p className="app-kicker">CONTINUE LEARNING</p><h2>Zero Trust Fundamentals</h2><p>Cybersecurity 101 · 18 min · Transcript and study tools ready</p></div><a href="/learn/lecture">Open lecture workspace →</a></section>
    </>
  );
}
