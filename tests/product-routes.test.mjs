import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("opens the protected multi-page product after Cognito sign-in", async () => {
  const [landing, shell] = await Promise.all([
    readFile(new URL("app/gwlearn-home.tsx", root), "utf8"),
    readFile(new URL("app/product-shell.tsx", root), "utf8"),
  ]);

  assert.match(landing, /redirectAfterSignIn="\/learn"/);
  for (const route of ["/learn", "/learn/library", "/learn/upload", "/learn/chat"]) {
    assert.match(shell, new RegExp(`href: "${route.replaceAll("/", "\\/")}"`));
  }
});

test("keeps every original GWLearn product surface as a separate route", async () => {
  const files = [
    "app/learn/page.tsx",
    "app/learn/library/page.tsx",
    "app/learn/upload/page.tsx",
    "app/learn/chat/page.tsx",
    "app/learn/lecture/page.tsx",
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")));
  assert.deepEqual(sources.map((source) => source.length > 100), [true, true, true, true, true]);
});
