import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("dedicated UI dotenv contains only synthetic loopback configuration", async () => {
  const environment = await readFile(
    new URL("config/codex-test-ui.env", projectRoot),
    "utf8",
  );

  assert.match(environment, /NUXT_PUBLIC_FIREBASE_USE_EMULATOR=true/);
  assert.match(
    environment,
    /NUXT_PUBLIC_FIREBASE_PROJECT_ID=demo-air-guard-v2-codex/,
  );
  assert.match(environment, /NUXT_PUBLIC_FIREBASE_EMULATOR_HOST=127\.0\.0\.1/);
  for (const port of [19099, 18080, 19000, 19199, 15001]) {
    assert.match(environment, new RegExp(`=${port}(?:\\r?\\n|$)`));
  }
  assert.doesNotMatch(environment, /air-guard-v2-(?:dev|prod)/i);
});

test("dedicated UI commands remain separate foreground processes", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", projectRoot), "utf8"),
  );
  const freshEmulators = packageJson.scripts["test:local:ui:emulators:fresh"];
  const emulators = packageJson.scripts["test:local:ui:emulators"];
  const candidateEmulators =
    packageJson.scripts["test:local:ui:emulators:candidate"];
  const candidateAcceptance =
    packageJson.scripts["test:local:ui:candidate:accept"];
  const server = packageJson.scripts["test:local:ui:server"];
  const generatedServer =
    packageJson.scripts["test:local:ui:server:generated"];
  const generatedBuild = packageJson.scripts["test:local:ui:build"];
  const exportState = packageJson.scripts["test:local:ui:export"];
  const promoteState = packageJson.scripts["test:local:ui:promote"];

  assert.match(freshEmulators, /firebase\.codex-test\.json/);
  assert.match(freshEmulators, /--project demo-air-guard-v2-codex/);
  assert.doesNotMatch(freshEmulators, /--import|--export-on-exit/);
  assert.match(emulators, /firebase\.codex-test\.json/);
  assert.match(emulators, /--project demo-air-guard-v2-codex/);
  assert.match(emulators, /emulators:start/);
  assert.match(emulators, /--import \.codex-test\/saved-data/);
  assert.match(candidateEmulators, /--import \.codex-test\/ui-candidate/);
  assert.match(candidateAcceptance, /accept-codex-local-ui-candidate\.mjs/);
  assert.match(server, /--dotenv config\/codex-test-ui\.env/);
  assert.match(server, /--host 127\.0\.0\.1 --port 14600/);
  assert.match(generatedServer, /serve-codex-local-ui\.mjs/);
  assert.match(generatedBuild, /build-codex-local-ui\.mjs/);
  assert.match(exportState, /export-codex-local-ui-state\.ps1/);
  assert.match(promoteState, /promote-codex-local-ui-state\.ps1/);
  assert.doesNotMatch(
    `${freshEmulators}\n${emulators}\n${candidateEmulators}\n${candidateAcceptance}\n${server}\n${generatedBuild}\n${generatedServer}\n${exportState}\n${promoteState}`,
    /Start-Process|--detach|&\s*$/,
  );
});

test("flagged PowerShell UI child helper is absent", async () => {
  await assert.rejects(
    access(new URL("scripts/run-codex-local-ui-child.ps1", projectRoot)),
    (error) => error?.code === "ENOENT",
  );
});

test("isolated seed does not imitate the regular UI account lifecycle", async () => {
  const seedSource = await readFile(
    new URL("scripts/seed-codex-local-test.mjs", projectRoot),
    "utf8",
  );
  const harnessSource = await readFile(
    new URL("scripts/run-codex-local-test.ps1", projectRoot),
    "utf8",
  );

  assert.doesNotMatch(seedSource, /sendEmailVerification|oobCodes|setCustomUserClaims/);
  assert.match(harnessSource, /isolated-saved-data/);
});

test("regular UI email confirmation uses only the Auth Emulator OOB route", async () => {
  const source = await readFile(
    new URL("scripts/confirm-codex-local-ui-email.mjs", projectRoot),
    "utf8",
  );

  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /demo-air-guard-v2-codex/);
  assert.match(source, /\/emulator\/v1\/projects\/\$\{PROJECT_ID\}\/oobCodes/);
  assert.match(source, /\/identitytoolkit\.googleapis\.com\/v1\/accounts:update\?key=codex-local-only/);
  assert.match(source, /requestType === "VERIFY_EMAIL"/);
  assert.match(source, /entry\.email === email/);
  assert.match(source, /@codex-test\\\.invalid/);
  assert.doesNotMatch(source, /https:\/\//);
});

test("generated UI server fixes loopback and external-effect denial", async () => {
  const source = await readFile(
    new URL("scripts/serve-codex-local-ui.mjs", projectRoot),
    "utf8",
  );

  assert.match(source, /NITRO_HOST: "127\.0\.0\.1"/);
  assert.match(source, /NITRO_PORT: "14600"/);
  assert.match(source, /AIR_GUARD_EXTERNAL_EFFECTS: "deny"/);
  assert.match(source, /assertCodexUiBuildIdentity/);
  assert.match(source, /CODEX_UI_BUILD_IDENTITY_FILE/);
  assert.match(source, /\.\.\/\.output\/server\/index\.mjs/);
});

test("UI snapshot export stages before replacing dedicated saved-data", async () => {
  const source = await readFile(
    new URL("scripts/export-codex-local-ui-state.ps1", projectRoot),
    "utf8",
  );

  assert.match(source, /\.codex-test/);
  assert.match(source, /ui-candidate/);
  assert.match(source, /runtime/);
  assert.match(source, /emulators:export/);
  assert.match(source, /Get-DirectoryFingerprint/);
  assert.match(source, /user-owned saved-data fingerprint changed/i);
  assert.match(source, /\$projectId = 'demo-air-guard-v2-codex'/);
  assert.match(source, /--project \$projectId/);
  assert.doesNotMatch(source, /Remove-Item[^\n]+savedDataPath/);
});

test("UI snapshot promotion happens only through the dedicated promotion script", async () => {
  const source = await readFile(
    new URL("scripts/promote-codex-local-ui-state.ps1", projectRoot),
    "utf8",
  );

  assert.match(source, /ui-candidate/);
  assert.match(source, /saved-data/);
  assert.match(source, /firebase-export-metadata\.json/);
  assert.match(source, /ui-candidate-acceptance\.json/);
  assert.match(source, /ui-promotion-backup/);
  assert.match(source, /GetActiveTcpListeners/);
  for (const port of [14400, 14500, 14600, 15001, 18080, 19000, 19099, 19199]) {
    assert.match(source, new RegExp(String(port)));
  }
  assert.match(source, /accept-codex-local-ui-candidate\.mjs/);
  assert.match(source, /--assert-only/);
  assert.match(source, /cleanup_required/);
  assert.match(source, /Move-Item -LiteralPath \$candidatePath -Destination \$savedDataPath/);
});

test("UI state verifier reads the regular lifecycle result without repairing it", async () => {
  const source = await readFile(
    new URL("scripts/verify-codex-local-ui-state.mjs", projectRoot),
    "utf8",
  );

  assert.match(source, /http:\/\/127\.0\.0\.1:19099/);
  assert.match(source, /demo-air-guard-v2-codex/);
  assert.match(source, /accounts:query/);
  assert.match(source, /authorization: "Bearer owner"/);
  assert.match(source, /maxResults: 2/);
  assert.match(source, /method: "GET"/);
  assert.match(source, /EMULATOR_ADMIN_HEADERS/);
  assert.match(source, /users\.length !== 1 \|\| hasMore/);
  assert.match(source, /authUser\.email !== email/);
  assert.match(source, /emailVerified !== true/);
  assert.match(source, /claims\.companyId/);
  assert.match(source, /isValidFirestorePathSegment/);
  assert.match(source, /encodeURIComponent\(claims\.companyId\)/);
  assert.match(source, /encodeURIComponent\(authUser\.localId\)/);
  assert.match(source, /companyNameKana/);
  assert.match(source, /claims\.isSuperUser !== false/);
  assert.match(source, /fieldValue\(user\.fields\?\.isAdmin\) !== true/);
  assert.doesNotMatch(
    source,
    /signInWithPassword|accounts:lookup|setCustomUserClaims|createUser|deleteUser|importUsers|setDoc|documents:commit|\.create\(|\.update\(/,
  );
  assert.doesNotMatch(source, /https:\/\//);
  assert.match(source, /try \{/);
  assert.match(source, /catch \(error\)/);
  assert.match(source, /ok: false/);
  assert.doesNotMatch(
    source,
    /console\.(?:log|dir)|JSON\.stringify\(authUser|response\.text\(|error\.message|error\.stack/,
  );
});
