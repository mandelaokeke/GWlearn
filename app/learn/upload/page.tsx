import type { Metadata } from "next";
import { UploadWorkspace } from "../../upload-workspace";
import { awsRuntimeConfig } from "../../aws-runtime-config";

export const metadata: Metadata = { title: "Upload video" };
export default function UploadPage() { return <div className="app-upload-page"><UploadWorkspace configurationInput={awsRuntimeConfig()} compact /></div>; }
