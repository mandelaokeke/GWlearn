import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gwlearn.dev"),
  title: {
    default: "GWLearn — AI-powered learning from lecture video",
    template: "%s | GWLearn",
  },
  description:
    "A TypeScript and AWS rebuild of GWLearn: transcript-grounded summaries, study tools, and AI chat for lecture video.",
  openGraph: {
    title: "GWLearn — Turn every lecture into a learning system",
    description:
      "A portfolio rebuild using TypeScript, DynamoDB, Amazon Transcribe, and Amazon Bedrock.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
