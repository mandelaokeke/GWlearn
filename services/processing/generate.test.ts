import assert from "node:assert/strict";
import test from "node:test";
import { parseArtifacts, timestampedTranscript } from "./generate.ts";

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

test("accepts strict Bedrock JSON and rejects incomplete artifacts", () => {
  const artifacts = parseArtifacts(
    '```json\n{"summary":"Grounded summary","studyGuide":["Review [00:02]"],"flashcards":[{"question":"What?","answer":"Trust"}]}\n```',
  );
  assert.equal(artifacts.flashcards[0].answer, "Trust");
  assert.throws(() => parseArtifacts('{"summary":"Only"}'));
});
