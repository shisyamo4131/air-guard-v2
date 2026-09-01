import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";

const SCHEMAS_PACKAGE = "@shisyamo4131/air-guard-v2-schemas";
const SCHEMAS_CONSTANTS = `${SCHEMAS_PACKAGE}/constants`;
const EXPECTED_VERSION = "3.0.0-dev.1";
const EXPECTED_RESOLVED =
  "https://registry.npmjs.org/@shisyamo4131/air-guard-v2-schemas/-/air-guard-v2-schemas-3.0.0-dev.1.tgz";
const EXPECTED_INTEGRITY =
  "sha512-Pg5ZdBI5MDP5Ks2sN/HtzLGDhtOYcGSOczFI+AYvT2hf0b4EqoS6ditTm3ca66mQ0YVNHX7EHchX19lbmv9/CA==";

const rootPackageJsonUrl = new URL("../../package.json", import.meta.url);
const rootPackageLockUrl = new URL("../../package-lock.json", import.meta.url);
const functionsPackageJsonUrl = new URL(
  "../../functions/package.json",
  import.meta.url,
);
const functionsPackageLockUrl = new URL(
  "../../functions/package-lock.json",
  import.meta.url,
);

const rootRequire = createRequire(rootPackageJsonUrl);
const functionsRequire = createRequire(functionsPackageJsonUrl);
const rootConstantsPath = rootRequire.resolve(SCHEMAS_CONSTANTS);
const functionsConstantsPath = functionsRequire.resolve(SCHEMAS_CONSTANTS);
const rootInstalledPackageJsonUrl = new URL(
  "../../package.json",
  pathToFileURL(rootConstantsPath),
);
const functionsInstalledPackageJsonUrl = new URL(
  "../../package.json",
  pathToFileURL(functionsConstantsPath),
);

const rootConstants = await import(pathToFileURL(rootConstantsPath).href);
const functionsConstants = await import(
  pathToFileURL(functionsConstantsPath).href,
);

const {
  ROLE_PRESETS: CLIENT_ROLE_PRESETS,
  ROLE_PRESET_IDS: CLIENT_ROLE_PRESET_IDS,
  isRolePresetId: clientIsRolePresetId,
} = rootConstants;
const {
  ROLE_PRESETS: SERVER_ROLE_PRESETS,
  ROLE_PRESET_IDS: SERVER_ROLE_PRESET_IDS,
  isRolePresetId: serverIsRolePresetId,
} = functionsConstants;

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

test("root and Functions load independent installed constants modules", () => {
  assert.notEqual(rootConstantsPath, functionsConstantsPath);
  assert.match(
    rootConstantsPath.replaceAll("\\", "/"),
    /\/node_modules\/@shisyamo4131\/air-guard-v2-schemas\/src\/constants\/index\.js$/,
  );
  assert.match(
    functionsConstantsPath.replaceAll("\\", "/"),
    /\/functions\/node_modules\/@shisyamo4131\/air-guard-v2-schemas\/src\/constants\/index\.js$/,
  );
});

test("root and Functions request, lock, and install the exact same published package", async () => {
  const [
    rootPackage,
    rootLock,
    functionsPackage,
    functionsLock,
    rootInstalledPackage,
    functionsInstalledPackage,
  ] =
    await Promise.all([
      readJson(rootPackageJsonUrl),
      readJson(rootPackageLockUrl),
      readJson(functionsPackageJsonUrl),
      readJson(functionsPackageLockUrl),
      readJson(rootInstalledPackageJsonUrl),
      readJson(functionsInstalledPackageJsonUrl),
    ]);

  const rootLockedPackage =
    rootLock.packages[`node_modules/${SCHEMAS_PACKAGE}`];
  const functionsLockedPackage =
    functionsLock.packages[`node_modules/${SCHEMAS_PACKAGE}`];

  assert.equal(rootPackage.dependencies[SCHEMAS_PACKAGE], EXPECTED_VERSION);
  assert.equal(functionsPackage.dependencies[SCHEMAS_PACKAGE], EXPECTED_VERSION);
  assert.equal(
    rootLock.packages[""].dependencies[SCHEMAS_PACKAGE],
    EXPECTED_VERSION,
  );
  assert.equal(
    functionsLock.packages[""].dependencies[SCHEMAS_PACKAGE],
    EXPECTED_VERSION,
  );
  assert.equal(rootLockedPackage.version, EXPECTED_VERSION);
  assert.equal(functionsLockedPackage.version, EXPECTED_VERSION);
  assert.equal(rootInstalledPackage.name, SCHEMAS_PACKAGE);
  assert.equal(functionsInstalledPackage.name, SCHEMAS_PACKAGE);
  assert.equal(rootInstalledPackage.version, EXPECTED_VERSION);
  assert.equal(functionsInstalledPackage.version, EXPECTED_VERSION);
  assert.equal(rootLockedPackage.resolved, EXPECTED_RESOLVED);
  assert.equal(functionsLockedPackage.resolved, EXPECTED_RESOLVED);
  assert.equal(rootLockedPackage.integrity, EXPECTED_INTEGRITY);
  assert.equal(functionsLockedPackage.integrity, EXPECTED_INTEGRITY);
});

test("client and server role preset tables are identical", () => {
  assert.deepEqual(SERVER_ROLE_PRESET_IDS, CLIENT_ROLE_PRESET_IDS);
  assert.deepEqual(SERVER_ROLE_PRESETS, CLIENT_ROLE_PRESETS);

  for (const role of CLIENT_ROLE_PRESET_IDS) {
    assert.equal(clientIsRolePresetId(role), true);
    assert.equal(serverIsRolePresetId(role), true);
  }

  for (const role of ["unknown-role", "toString", "constructor", "__proto__"]) {
    assert.equal(clientIsRolePresetId(role), false);
    assert.equal(serverIsRolePresetId(role), false);
  }
});

test("User provisioning permission is granted only by the approved presets", () => {
  const rolesWithProvision = Object.entries(SERVER_ROLE_PRESETS)
    .filter(([, preset]) => preset.permissions.includes("users:provision"))
    .map(([role]) => role)
    .sort();

  assert.deepEqual(rolesWithProvision, ["human-resource", "manager"]);

  const rolesWithUserWrite = Object.entries(SERVER_ROLE_PRESETS)
    .filter(([, preset]) => preset.permissions.includes("users:write"))
    .map(([role]) => role)
    .sort();
  assert.deepEqual(rolesWithUserWrite, ["manager"]);
});

test("Employee termination permission is granted only to human-resource", () => {
  const rolesWithTermination = Object.entries(SERVER_ROLE_PRESETS)
    .filter(([, preset]) =>
      preset.permissions.includes("employees:terminate"),
    )
    .map(([role]) => role)
    .sort();

  assert.deepEqual(rolesWithTermination, ["human-resource"]);
});
