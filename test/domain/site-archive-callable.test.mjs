import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { archiveSite } from "../../functions/apis/archiveSite.js";

const apiSourceUrl = new URL("../../functions/apis/archiveSite.js", import.meta.url);
const apiIndexSourceUrl = new URL("../../functions/apis/index.js", import.meta.url);

test("archiveSite rejects unauthenticated requests", async () => {
  await assert.rejects(archiveSite.run({ data: {} }), (error) => {
    assert.equal(error.constructor.name, "HttpsError");
    assert.equal(error.code, "unauthenticated");
    assert.equal(error.message, "認証が必要です。");
    return true;
  });
});

test("archiveSite exposes no dependency replacement API", () => {
  assert.deepEqual(Object.keys(archiveSite).sort(), ["__endpoint", "run", "stream"]);
});

test("Site archive Callable derives actor and tenant from current Auth only", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  assert.match(source, /resolveCallableAuthIdentity\s*\(\{/u);
  assert.match(source, /tokenUid:\s*request\.auth\.uid/u);
  assert.match(source, /tokenEmail:\s*request\.auth\.token\?\.email/u);
  assert.match(source, /tokenEmailVerified:\s*request\.auth\.token\?\.email_verified/u);
  assert.match(source, /tokenCompanyId:\s*request\.auth\.token\?\.companyId/u);
  assert.match(source, /tokenIsSuperUser:\s*request\.auth\.token\?\.isSuperUser/u);
  assert.match(
    source,
    /archiveSiteUseCase\s*\(\{[\s\S]*?firestore:\s*getFirestore\(\),[\s\S]*?identity,[\s\S]*?input:\s*request\.data/u,
  );
  for (const forbidden of [
    "request.data?.companyId", "request.data.companyId",
    "request.data?.actorUid", "request.data.actorUid",
    "request.data?.archivedAt", "request.data.archivedAt",
    "request.data?.site", "request.data.site",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(source, /mapSiteArchiveError\s*\(error\)/u);
});

test("Site archive failure logging contains fixed classifications only", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  assert.doesNotMatch(source, /console\s*\.|logger\.error\s*\(/u);
  assert.match(
    source,
    /logger\.write\(\{\s*severity:\s*"ERROR",\s*message:\s*"Site archive failed",/u,
  );
  const block = source.match(/logger\.write\(\{[\s\S]*?\}\);/u)?.[0];
  assert.ok(block);
  for (const field of ["severity", "message", "errorName", "errorCode"]) {
    assert.match(block, new RegExp(`\\b${field}:`, "u"));
  }
  for (const forbidden of [
    "request", "siteId", "companyId", "identity.uid", "reason", "snapshot",
    "token", "claims", "error.message", "error.stack", "error.cause",
  ]) assert.equal(block.includes(forbidden), false, forbidden);
});

test("public API exports the Site archive Callable but not internal use-case symbols", async () => {
  const source = await readFile(apiIndexSourceUrl, "utf8");
  assert.match(source, /export \{ archiveSite \} from "\.\/archiveSite\.js";/u);
  assert.equal(source.includes("archiveSiteUseCase"), false);
  assert.equal(source.includes("mapSiteArchiveError"), false);
});
