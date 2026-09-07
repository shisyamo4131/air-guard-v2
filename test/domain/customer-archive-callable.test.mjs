import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { archiveCustomer } from "../../functions/apis/archiveCustomer.js";

const apiSourceUrl = new URL(
  "../../functions/apis/archiveCustomer.js",
  import.meta.url,
);
const apiIndexSourceUrl = new URL(
  "../../functions/apis/index.js",
  import.meta.url,
);

test("archiveCustomer rejects unauthenticated requests", async () => {
  await assert.rejects(archiveCustomer.run({ data: {} }), (error) => {
    assert.equal(error.constructor.name, "HttpsError");
    assert.equal(error.code, "unauthenticated");
    assert.equal(error.message, "認証が必要です。");
    return true;
  });
});

test("archiveCustomer exposes no dependency replacement API", () => {
  assert.deepEqual(Object.keys(archiveCustomer).sort(), [
    "__endpoint",
    "run",
    "stream",
  ]);
});

test("Callable uses current Auth identity and passes only server-derived identity plus request data", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  assert.match(source, /resolveCallableAuthIdentity\s*\(\{/u);
  assert.match(source, /tokenUid:\s*request\.auth\.uid/u);
  assert.match(source, /tokenEmail:\s*request\.auth\.token\?\.email/u);
  assert.match(
    source,
    /tokenEmailVerified:\s*request\.auth\.token\?\.email_verified/u,
  );
  assert.match(source, /tokenCompanyId:\s*request\.auth\.token\?\.companyId/u);
  assert.match(
    source,
    /tokenIsSuperUser:\s*request\.auth\.token\?\.isSuperUser/u,
  );
  assert.match(
    source,
    /archiveCustomerUseCase\s*\(\{[\s\S]*?firestore:\s*getFirestore\(\),[\s\S]*?identity,[\s\S]*?input:\s*request\.data/u,
  );
  for (const forbidden of [
    "request.data?.companyId",
    "request.data.companyId",
    "request.data?.actorUid",
    "request.data.actorUid",
    "request.data?.archivedAt",
    "request.data.archivedAt",
    "request.data?.customer",
    "request.data.customer",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /mapCustomerArchiveError\s*\(error\)/u);
});

test("failure logging contains only fixed metadata classifications", async () => {
  const source = await readFile(apiSourceUrl, "utf8");
  assert.doesNotMatch(source, /console\s*\./u);
  assert.doesNotMatch(source, /logger\.error\s*\(/u);
  assert.match(
    source,
    /logger\.write\(\{\s*severity:\s*"ERROR",\s*message:\s*"Customer archive failed",/u,
  );
  const loggingBlock = source.match(
    /logger\.write\(\{[\s\S]*?\}\);/u,
  )?.[0];
  assert.ok(loggingBlock);
  assert.deepEqual(
    [...loggingBlock.matchAll(/^\s{6}([a-zA-Z]+):/gmu)].map((match) => match[1]),
    ["severity", "message", "errorName", "errorCode"],
  );
  for (const forbidden of [
    "request",
    "customerId",
    "companyId",
    "identity.uid",
    "reason",
    "snapshot",
    "token",
    "claims",
    "error.message",
    "error.stack",
    "error.cause",
  ]) {
    assert.equal(loggingBlock.includes(forbidden), false, forbidden);
  }
});

test("API index exports only the public archiveCustomer Callable", async () => {
  const source = await readFile(apiIndexSourceUrl, "utf8");
  assert.match(
    source,
    /export \{ archiveCustomer \} from "\.\/archiveCustomer\.js";/u,
  );
  assert.equal(source.includes("archiveCustomerUseCase"), false);
  assert.equal(source.includes("mapCustomerArchiveError"), false);
});
