import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import FireModel from "@shisyamo4131/air-firebase-v2";
import Site from "../../schemas/Site.js";
import ClientAdapter from "@shisyamo4131/air-firebase-v2-client-adapter";

test("root Site uses logical delete and exact three hasMany dependencies", () => {
  assert.equal(Site.logicalDelete, true);
  assert.deepEqual(Site.hasMany, [
    { collectionPath: "SiteOperationSchedules", field: "siteId", condition: "==", type: "collection" },
    { collectionPath: "OperationResults", field: "siteId", condition: "==", type: "collection" },
    { collectionPath: "ArrangementNotifications", field: "siteId", condition: "==", type: "collection" },
  ]);
});

test("Site.delete delegates to the adapter with the current transaction", async () => {
  let original = null;
  try { original = FireModel.getAdapter(); } catch { /* adapter is unset in an isolated test */ }
  const calls = [];
  const adapter = { delete: async (args) => { calls.push(args); return "deleted"; } };
  FireModel.setAdapter(adapter);
  try {
    const site = new Site({ docId: "site-a" });
    const transaction = {};
    assert.equal(await site.delete({ transaction }), "deleted");
    assert.equal(calls[0].transaction, transaction);
  } finally { FireModel.setAdapter(original); }
});

test("installed ClientAdapter delete source is raw atomic same-ID archive plus live delete", async () => {
  const source = await readFile(new URL("../../node_modules/@shisyamo4131/air-firebase-v2-client-adapter/index.js", import.meta.url), "utf8");
  const deleteStart = source.indexOf("async delete(args = {})");
  const restoreStart = source.indexOf("  async restore(", deleteStart);
  assert.ok(deleteStart >= 0);
  assert.ok(restoreStart > deleteStart);
  const method = source.slice(deleteStart, restoreStart);
  assert.match(method, /hasChild/u);
  assert.match(method, /txn\.get\(docRef\)/u);
  assert.match(method, /txn\.set\(archiveDocRef, sourceDocData\)/u);
  assert.match(method, /txn\.delete\(docRef\)/u);
  assert.doesNotMatch(method, /envelope|archiveSite|httpsCallable/u);
});
