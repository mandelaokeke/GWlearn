import type { Metadata } from "next";
import { awsRuntimeConfig } from "../../aws-runtime-config";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "AI chat" };
export default function ChatPage() {
  return <section className="app-page"><div className="app-page-heading"><div><p className="app-kicker">LECTURE-GROUNDED ASSISTANT</p><h1>AI chat</h1><p>Select a processed lecture and ask questions grounded in its transcript.</p></div></div><ChatClient configurationInput={awsRuntimeConfig()} /><p className="demo-note">Powered by Amazon Bedrock. GWLearn sends only the selected lecture transcript and a bounded chat history for each answer.</p></section>;
}
