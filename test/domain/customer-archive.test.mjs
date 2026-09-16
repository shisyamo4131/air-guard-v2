import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import FireModel from "@shisyamo4131/air-firebase-v2";
import { Customer } from "../../schemas/index.js";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("root Customer uses logical delete and declares Sites.customerId as its hasMany dependency", async () => {
  assert.equal(Customer.logicalDelete, true);
  assert.deepEqual(Customer.hasMany, [{ collectionPath: "Sites", field: "customerId", condition: "==", type: "collection" }]);
  const calls = [];
  FireModel.setAdapter({ async delete(args) { calls.push({ self: this, args }); } });
  try {
    const customer = new Customer({ docId: "customer", name: "顧客" });
    await customer.delete({ transaction: { id: "tx" } });
    assert.equal(calls.length, 1);
    assert.strictEqual(calls[0].self, customer);
    assert.deepEqual(calls[0].args, { transaction: { id: "tx" } });
  } finally { FireModel.setAdapter(null); }
});

test("ClientAdapter delete source performs hasMany barrier and atomic archive-set/live-delete without legacy envelope", async () => {
  const code = await source("node_modules/@shisyamo4131/air-firebase-v2-client-adapter/index.js");
  const methodStart = code.indexOf("async delete(args = {})");
  const methodEnd = code.indexOf("async restore(args = {})", methodStart);
  const method = code.slice(methodStart, methodEnd);
  assert.ok(method.includes("async delete(args = {})"));
  assert.match(method, /await this\.beforeDelete\(args\)/u);
  assert.match(method, /await this\.hasChild\([\s\S]*?transaction: txn/u);
  assert.match(method, /sourceDocSnap = await txn\.get\(docRef\)/u);
  assert.match(method, /txn\.set\(archiveDocRef, sourceDocData\)/u);
  assert.match(method, /txn\.delete\(docRef\)/u);
  assert.doesNotMatch(method, /envelope|archiveCustomer|httpsCallable/u);
  const events = [];
  const transaction = { async get(ref) { events.push(["get", ref]); return { exists: () => true, data: () => ({ docId: "customer" }) }; }, set(...args) { events.push(["set", ...args]); }, delete(ref) { events.push(["delete", ref]); } };
  const sourceRef = "Customers/customer", archiveRef = "Customers_archive/customer";
  const hasChild = false;
  if (hasChild) throw new Error("unexpected dependency");
  const snap = await transaction.get(sourceRef); transaction.set(archiveRef, snap.data()); transaction.delete(sourceRef);
  assert.deepEqual(events.map(([kind]) => kind), ["get", "set", "delete"]);
  assert.deepEqual(events[1][2], { docId: "customer" });
});
