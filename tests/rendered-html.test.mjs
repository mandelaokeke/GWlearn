import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the GWLearn portfolio shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>GWLearn — Turn every lecture into a learning system<\/title>/i);
  assert.match(html, /Turn every lecture into a learning system/i);
  assert.match(html, /Zero Trust Fundamentals/i);
  assert.match(html, /Amazon Cognito/i);
  assert.match(html, /DynamoDB/i);
  assert.match(html, /Transcribe \+ Bedrock/i);
  assert.match(html, /The upload path is built/i);
  assert.match(html, /Authenticated intake, without a fake success state/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});
