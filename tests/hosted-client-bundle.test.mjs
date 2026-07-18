import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("hosted Cognito bundle uses the browser global", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const assets = await readdir(assetsDirectory);
  const fileName = assets.find((name) => /^gwlearn-home-.*\.js$/.test(name));

  assert.ok(fileName, "the GWLearn browser entry must be emitted");
  const source = await readFile(join(assetsDirectory.pathname, fileName), "utf8");

  assert.match(source, /Sign in to upload privately/);
  assert.match(source, /globalThis\.TYPED_ARRAY_SUPPORT/);
  assert.doesNotMatch(source, /\bglobal\.TYPED_ARRAY_SUPPORT/);
});
