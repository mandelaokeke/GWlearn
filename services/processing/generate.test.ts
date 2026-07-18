import assert from "node:assert/strict";
import test from "node:test";
import { parseArtifacts, timestampedTranscript, transcriptMarkdown } from "./generate.ts";

test("turns Transcribe items into compact timestamped lines", () => {
  assert.equal(
    timestampedTranscript({
      results: {
        items: [
          { alternatives: [{ content: "Zero" }], start_time: "2.4", type: "pronunciation" },
          { alternatives: [{ content: "trust" }], start_time: "2.8", type: "pronunciation" },
          { alternatives: [{ content: "." }], type: "punctuation" },
        ],
      },
    }),
    "[00:02] Zero trust.",
  );
});

test("stores the readable transcript as timestamped Markdown", () => {
  assert.equal(
    transcriptMarkdown("[00:02] Trust must be verified.\n[00:09] Access stays limited."),
    "# Lecture transcript\n\n> Generated from the uploaded lecture by Amazon Transcribe.\n\n## 00:02\n\nTrust must be verified.\n\n## 00:09\n\nAccess stays limited.",
  );
});

test("accepts strict Bedrock JSON and rejects incomplete artifacts", () => {
  const artifacts = parseArtifacts(
    '```json\n{"summary":"Grounded summary","studyGuide":["Review [00:02]"],"flashcards":[{"question":"What?","answer":"Trust"}]}\n```',
  );
  assert.equal(artifacts.flashcards[0].answer, "Trust");
  assert.throws(() => parseArtifacts('{"summary":"Only"}'));
});
