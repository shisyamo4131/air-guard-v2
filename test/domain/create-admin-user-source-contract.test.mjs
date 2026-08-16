import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../../composables/useCreateAdminUser.js",
  import.meta.url,
);
const pageSourceUrl = new URL("../../pages/auth/sign-up-admin.vue", import.meta.url);
const authFunctionsSourceUrl = new URL(
  "../../composables/auth/useAuthFunctions.js",
  import.meta.url,
);

test("administrator signup sends no client-selected preflight policy", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /checkEmailAvailability\(\{ email \}\)/);
  assert.equal(source.includes("isAdmin"), false);
  assert.equal(source.includes("checkEmailAvailabilityGlobal"), false);
});

test("administrator signup defers Company and User creation until email verification", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const createAuthIndex = source.indexOf("createUserWithEmailAndPassword(");
  const verificationIndex = source.indexOf(
    "sendEmailVerification(userCredential.user)",
  );
  const pendingSetupIndex = source.indexOf("localStorage.setItem(");
  const successIndex = source.indexOf(
    "return { success: true, userCredential }",
  );

  assert.ok(createAuthIndex >= 0);
  assert.ok(verificationIndex > createAuthIndex);
  assert.ok(pendingSetupIndex > verificationIndex);
  assert.ok(successIndex > pendingSetupIndex);
  assert.equal(source.includes("createAdminAccount("), false);
  assert.equal(source.includes("getIdToken(true)"), false);
  assert.equal(source.includes("setUser("), false);
});

test("pending administrator setup is stored by UID without credentials", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /companyName/);
  assert.match(source, /companyNameKana/);
  assert.match(source, /displayName/);
  assert.equal(source.includes("JSON.stringify({\n      email"), false);
  assert.equal(source.includes("JSON.stringify({\n      password"), false);
});

test("administrator signup page sends no client-selected preflight policy", async () => {
  const source = await readFile(pageSourceUrl, "utf8");

  assert.match(
    source,
    /checkEmailAvailability\(\{ email: model\.email \}\)/,
  );
  assert.equal(source.includes("isAdmin"), false);
  assert.equal(source.includes("auth-v2.js"), false);
});

test("email preflight client contract is administrator signup with email only", async () => {
  const source = await readFile(authFunctionsSourceUrl, "utf8");

  assert.match(source, /管理者サインアップ前/);
  assert.match(source, /@param \{string\} data\.email/);
  assert.equal(source.includes("isAdmin"), false);
});
