import type { Metadata } from "next";
import { GWLearnHome } from "./gwlearn-home";
import { awsRuntimeConfig } from "./aws-runtime-config";

export const metadata: Metadata = {
  title: { absolute: "GWLearn — Turn every lecture into a learning system" },
  description:
    "Upload a lecture once, then learn from its transcript, summaries, study guides, flashcards, and grounded AI chat.",
};

export default function Home() {
  return (
    <GWLearnHome
      awsConfiguration={awsRuntimeConfig()}
    />
  );
}
