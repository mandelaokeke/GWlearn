import type { Metadata } from "next";

export const metadata: Metadata = { title: "AI chat" };
export default function ChatPage() {
  return <section className="app-page"><div className="app-page-heading"><div><p className="app-kicker">LECTURE-GROUNDED ASSISTANT</p><h1>AI chat</h1><p>Pick a processed lecture before asking a question.</p></div></div><div className="chat-workspace"><aside><span className="lecture-status">Selected lecture</span><h2>Zero Trust Fundamentals</h2><p>Cybersecurity 101</p><a href="/learn/lecture">View source →</a></aside><div className="chat-thread"><div className="chat-empty"><span>GW</span><h2>Ask this lecture anything.</h2><p>Answers will stay grounded in the transcript and point back to timestamps.</p></div><form><label className="sr-only" htmlFor="chat-question">Question</label><input id="chat-question" placeholder="Bedrock chat is the next connected workflow…" disabled /><button type="button" disabled>Send</button></form></div></div><p className="demo-note">The transcription and Bedrock study-material pipeline is live. Multi-turn chat is shown as a product page and remains intentionally disabled until its authenticated API is added.</p></section>;
}
