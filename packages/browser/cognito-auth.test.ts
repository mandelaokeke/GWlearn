import assert from "node:assert/strict";
import test from "node:test";
import { emailFromIdToken } from "./cognito-auth.ts";

test("uses the verified Cognito email claim instead of the internal username", () => {
  assert.equal(emailFromIdToken({ email: "student@example.com", sub: "internal-id" }, "internal-id"), "student@example.com");
});

test("keeps a safe fallback when an older token has no email claim", () => {
  assert.equal(emailFromIdToken({ sub: "internal-id" }, "student@example.com"), "student@example.com");
});
