import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../composables/useCreateNormalUser.js",
  import.meta.url,
);

test("normal signup stops after sending the verification email", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const createIndex = source.indexOf("createUserWithEmailAndPassword(");
  const verificationIndex = source.indexOf(
    "sendEmailVerification(userCredential.user)",
  );
  const successIndex = source.indexOf(
    "return { success: true, userCredential }",
  );

  assert.ok(createIndex >= 0);
  assert.ok(verificationIndex > createIndex);
  assert.ok(successIndex > verificationIndex);
});

test("normal signup does not complete registration before verification", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.equal(source.includes("setupUserAccount"), false);
  assert.equal(source.includes("getIdToken(true)"), false);
});
