import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

interface TranscriptItem {
  alternatives?: Array<{ content?: string }>;
  start_time?: string;
  type?: "pronunciation" | "punctuation";
}

interface TranscribeDocument {
  results?: { items?: TranscriptItem[]; transcripts?: Array<{ transcript?: string }> };
}

export interface LearningArtifacts {
  flashcards: Array<{ answer: string; question: string }>;
  studyGuide: string[];
  summary: string;
}

export function timestampedTranscript(document: TranscribeDocument): string {
  const items = document.results?.items ?? [];
  if (items.length === 0) return document.results?.transcripts?.[0]?.transcript?.trim() ?? "";

  const lines: string[] = [];
  let words: string[] = [];
  let lineStart = "00:00";
  for (const item of items) {
    const content = item.alternatives?.[0]?.content;
    if (!content) continue;
    if (item.type === "pronunciation") {
      if (words.length === 0) {
        const seconds = Math.floor(Number(item.start_time ?? 0));
        lineStart = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      }
      words.push(content);
      if (words.length >= 35) {
        lines.push(`[${lineStart}] ${words.join(" ")}`);
        words = [];
      }
    } else if (words.length > 0) {
      words[words.length - 1] += content;
    }
  }
  if (words.length > 0) lines.push(`[${lineStart}] ${words.join(" ")}`);
  return lines.join("\n");
}

export function parseArtifacts(text: string): LearningArtifacts {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const value = JSON.parse(cleaned) as Partial<LearningArtifacts>;
  if (
    typeof value.summary !== "string" ||
    !Array.isArray(value.studyGuide) ||
    !value.studyGuide.every((entry) => typeof entry === "string") ||
    !Array.isArray(value.flashcards) ||
    !value.flashcards.every(
      (card) => typeof card?.question === "string" && typeof card?.answer === "string",
    )
  ) {
    throw new Error("Bedrock returned an invalid learning-artifact document");
  }
  return value as LearningArtifacts;
}

export class ArtifactGenerator {
  private readonly bedrock: BedrockRuntimeClient;
  private readonly database: DynamoDBDocumentClient;
  private readonly modelId: string;
  private readonly s3: S3Client;
  private readonly tableName: string;

  constructor(
    s3: S3Client,
    database: DynamoDBDocumentClient,
    bedrock: BedrockRuntimeClient,
    tableName: string,
    modelId: string,
  ) {
    this.bedrock = bedrock;
    this.database = database;
    this.modelId = modelId;
    this.s3 = s3;
    this.tableName = tableName;
  }

  async generate(input: {
    bucketName: string;
    ownerId: string;
    transcriptKey: string;
    videoId: string;
  }) {
    const key = { PK: `VIDEO#${input.videoId}`, SK: "METADATA" };
    const now = new Date().toISOString();
    await this.database.send(
      new UpdateCommand({
        ConditionExpression: "#status = :transcribing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":generating": "GENERATING",
          ":transcribing": "TRANSCRIBING",
          ":updatedAt": now,
        },
        Key: key,
        TableName: this.tableName,
        UpdateExpression: "SET #status = :generating, updatedAt = :updatedAt",
      }),
    );

    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: input.bucketName, Key: input.transcriptKey }),
    );
    const document = JSON.parse(await object.Body!.transformToString()) as TranscribeDocument;
    const transcript = timestampedTranscript(document);
    if (!transcript) throw new Error("Amazon Transcribe returned an empty transcript");

    const maximumTranscriptCharacters = 180_000;
    const boundedTranscript = transcript.slice(0, maximumTranscriptCharacters);
    const response = await this.bedrock.send(
      new ConverseCommand({
        inferenceConfig: { maxTokens: 3000, temperature: 0.2 },
        messages: [{
          role: "user",
          content: [{ text: `Create accurate study materials using only claims stated in the timestamped lecture transcript below. Do not infer benefits, consequences, definitions, or background knowledge that the speaker did not state. Return JSON only with this exact shape: {"summary":"string","studyGuide":["string"],"flashcards":[{"question":"string","answer":"string"}]}. Include timestamp references where useful. Return 1-10 study-guide points and 1-12 flashcards; use fewer items for a short or repetitive transcript instead of inventing material.\n\nTRANSCRIPT\n${boundedTranscript}` }],
        }],
        modelId: this.modelId,
        system: [{ text: "You are GWLearn's source-grounded learning assistant. Never add facts not present in the lecture." }],
      }),
    );
    const output = response.output?.message?.content?.find((block) => "text" in block)?.text;
    if (!output) throw new Error("Amazon Bedrock returned no text output");
    const artifacts = parseArtifacts(output);
    const artifactKey = `private/${input.ownerId}/videos/${input.videoId}/artifacts/learning.json`;
    const transcriptTextKey = `private/${input.ownerId}/videos/${input.videoId}/transcript/timestamped.txt`;

    await Promise.all([
      this.s3.send(new PutObjectCommand({
        Body: JSON.stringify({
          ...artifacts,
          generatedAt: now,
          modelId: this.modelId,
          promptVersion: "2026-07-17.v2",
          transcriptTruncated: transcript.length > maximumTranscriptCharacters,
        }),
        Bucket: input.bucketName,
        ContentType: "application/json",
        Key: artifactKey,
      })),
      this.s3.send(new PutObjectCommand({
        Body: transcript,
        Bucket: input.bucketName,
        ContentType: "text/plain; charset=utf-8",
        Key: transcriptTextKey,
      })),
    ]);

    await this.database.send(
      new UpdateCommand({
        ConditionExpression: "#status = :generating",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":artifactKey": artifactKey,
          ":generating": "GENERATING",
          ":modelId": this.modelId,
          ":ready": "READY",
          ":transcriptTextKey": transcriptTextKey,
          ":updatedAt": new Date().toISOString(),
        },
        Key: key,
        TableName: this.tableName,
        UpdateExpression: "SET #status = :ready, artifactKey = :artifactKey, transcriptTextKey = :transcriptTextKey, modelId = :modelId, updatedAt = :updatedAt",
      }),
    );
    return { artifactKey, status: "READY", transcriptTextKey: transcriptTextKey };
  }
}
