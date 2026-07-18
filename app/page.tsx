import type { Metadata } from "next";
import { GWLearnHome } from "./gwlearn-home";

export const metadata: Metadata = {
  title: { absolute: "GWLearn — Turn every lecture into a learning system" },
  description:
    "Upload a lecture once, then learn from its transcript, summaries, study guides, flashcards, and grounded AI chat.",
};

export default function Home() {
  return (
    <GWLearnHome
      awsConfiguration={{
        apiUrl: process.env.NEXT_PUBLIC_GWLEARN_API_URL,
        region: process.env.NEXT_PUBLIC_AWS_REGION,
        userPoolClientId: process.env.NEXT_PUBLIC_GWLEARN_USER_POOL_CLIENT_ID,
        userPoolId: process.env.NEXT_PUBLIC_GWLEARN_USER_POOL_ID,
      }}
    />
  );
}
