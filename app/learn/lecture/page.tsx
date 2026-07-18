import type { Metadata } from "next";
import { awsRuntimeConfig } from "../../aws-runtime-config";
import { LectureClient } from "./lecture-client";

export const metadata: Metadata = { title: "Lecture workspace" };
export default function LecturePage() {
  return <LectureClient configurationInput={awsRuntimeConfig()} />;
}
