import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../../pages/unconfirmedEmail.vue", import.meta.url);

test("verified normal user completes setup before session initialization", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const reloadIndex = source.indexOf("await currentUser.reload()");
  const refreshIndex = source.indexOf(
    "await currentUser.getIdTokenResult(true)",
  );
  const setupIndex = source.indexOf("await setupUserAccount()");
  const sessionIndex = source.indexOf("await setUser(currentUser)");
  const redirectIndex = source.indexOf(
    'await router.replace("/dashboard")',
  );

  assert.ok(reloadIndex >= 0);
  assert.ok(refreshIndex > reloadIndex);
  assert.ok(setupIndex > refreshIndex);
  assert.ok(sessionIndex > setupIndex);
  assert.ok(redirectIndex > sessionIndex);
});

test("admin claim skips normal-user setup and polling is single-flight", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /if \(!idTokenResult\.claims\?\.companyId\)/);
  assert.match(source, /if \(!currentUser \|\| verificationCheckInProgress\) return/);
  assert.match(source, /verificationCheckInProgress = true/);
  assert.match(source, /finally \{[\s\S]*verificationCheckInProgress = false/);
});
