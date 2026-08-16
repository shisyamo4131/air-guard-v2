import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../composables/useCreateNormalUser.js",
  import.meta.url,
);
const signUpPageUrl = new URL("../../pages/auth/sign-up.vue", import.meta.url);

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

test("normal signup UI does not consume anonymous pre-registration metadata", async () => {
  const source = await readFile(signUpPageUrl, "utf8");

  assert.equal(source.includes("preReg.displayName"), false);
  assert.equal(source.includes("preRegData.displayName"), false);
  assert.match(source, /利用者様の事前登録を確認しました。/);
  assert.match(source, /利用者として登録します/);
});
