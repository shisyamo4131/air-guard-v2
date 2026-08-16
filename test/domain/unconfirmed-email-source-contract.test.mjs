import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../../pages/unconfirmedEmail.vue", import.meta.url);

test("verified normal user completes setup before session initialization", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(
    source,
    /import \{ useAuthFunctions \} from "@\/composables\/auth\/useAuthFunctions";/,
  );
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

test("verified administrator completes pending setup before session initialization", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const refreshIndex = source.indexOf(
    "await currentUser.getIdTokenResult(true)",
  );
  const pendingSetupIndex = source.indexOf("localStorage.getItem(");
  const createIndex = source.indexOf("await createAdminAccount(");
  const claimRefreshIndex = source.indexOf(
    "await currentUser.getIdToken(true)",
  );
  const removeIndex = source.indexOf("localStorage.removeItem(");
  const sessionIndex = source.indexOf("await setUser(currentUser)");

  assert.match(
    source,
    /const \{ createAdminAccount, setupUserAccount \} = useAuthFunctions\(\)/,
  );
  assert.ok(refreshIndex >= 0);
  assert.ok(pendingSetupIndex > refreshIndex);
  assert.ok(createIndex > pendingSetupIndex);
  assert.ok(claimRefreshIndex > createIndex);
  assert.ok(removeIndex > claimRefreshIndex);
  assert.ok(sessionIndex > removeIndex);
});

test("pending administrator setup is scoped to the current UID and validated", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(
    source,
    /airguard-v2:pending-admin-account-setup:\$\{currentUser\.uid\}/,
  );
  assert.match(source, /JSON\.parse/);
  assert.match(source, /typeof pendingAdminSetup\.companyName !== "string"/);
  assert.match(source, /typeof pendingAdminSetup\.companyNameKana !== "string"/);
  assert.match(source, /typeof pendingAdminSetup\.displayName !== "string"/);
});
