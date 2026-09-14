import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquirePrivateLifecycleLock, decodePrivateFirestoreValue, encodePrivateFirestoreValue, privateArtifactPayloadDigest,
  readPrivateArtifact, validatePrivateArtifactPath, writeNewPrivateArtifact,
} from "../../scripts/lib/private-firestore-receipt.mjs";
import {
  buildRepairBatches, commitApplyBatch, commitRollbackBatch, executeApplyRepair, inspectBatchState,
  inspectRollbackState, OPERATION_REPAIR_ROOT, parseApplyRepairArgs, runApplyOrRollback, validateReceipt,
  validateApplyArtifacts,
} from "../../scripts/apply-operation-result-projection-repair.mjs";
import { parsePrepareRepairArgs, REPAIR_COUNTS } from "../../scripts/prepare-operation-result-projection-repair.mjs";
import { canonicalProjectionDigest } from "../../scripts/lib/operation-result-projection-plan.mjs";

const sha = "a".repeat(64), commit = "b".repeat(40);
const common = ["--project", "air-guard-v2-dev", "--database", "(default)", "--expected-commit", commit];
const files = ["--snapshot-file", "D:\\private\\snapshot.json"];
const applyArgs = ["--apply", ...common, ...files];

test("mode is explicit and mutually exclusive", () => {
  assert.equal(parseApplyRepairArgs(applyArgs).mode, "apply");
  assert.equal(parseApplyRepairArgs(["--rollback", ...applyArgs.slice(1)]).mode, "rollback");
  assert.throws(() => parseApplyRepairArgs(applyArgs.slice(1)));
  assert.throws(() => parseApplyRepairArgs(["--rollback", ...applyArgs]));
  assert.throws(() => parseApplyRepairArgs([...applyArgs, "--unknown", "value"]));
});

test("prepare arguments reject unsafe target and missing limits", () => {
  const args = ["--prepare", ...common, "--companies-file", "D:\\private\\companies.json", ...files,
    "--start-date", "2026-09-05", "--end-date", "2026-09-14", "--page-size", "100",
    "--max-operation-results", "1000", "--max-billings", "1000", "--max-daily-attendances", "1000",
    "--max-daily-operations-by-employee", "1000", "--max-site-employee-histories", "1000",
    "--max-customers", "100", "--timeout-ms", "5000"];
  assert.equal(parsePrepareRepairArgs(args).startDate, "2026-09-05");
  assert.throws(() => parsePrepareRepairArgs(args.filter((value) => value !== "--prepare")));
  const wrong = [...args]; wrong[wrong.indexOf("air-guard-v2-dev")] = "production";
  assert.throws(() => parsePrepareRepairArgs(wrong));
});

test("private codec reverses timestamps, dates, bytes, geopoints, references, arrays and maps", () => {
  class Timestamp { constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; } toDate() { return new Date(this.seconds * 1000); } }
  class GeoPoint { constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; } isEqual() { return true; } }
  const value = { when: new Timestamp(7, 123), date: new Date("2026-09-05T00:00:00.000Z"), bytes: Buffer.from("abc"),
    point: new GeoPoint(35, 139), ref: { path: "Companies/c/OperationResults/o", firestore: {} }, list: [NaN, -0] };
  const decoded = decodePrivateFirestoreValue(encodePrivateFirestoreValue(value), { Timestamp, GeoPoint, reference: (path) => ({ path }) });
  assert.deepEqual([decoded.when.seconds, decoded.when.nanoseconds], [7, 123]);
  assert.equal(decoded.date.toISOString(), value.date.toISOString()); assert.equal(decoded.bytes.toString(), "abc");
  assert.equal(decoded.ref.path, value.ref.path); assert(Number.isNaN(decoded.list[0])); assert(Object.is(decoded.list[1], -0));
  assert.equal(privateArtifactPayloadDigest(value), privateArtifactPayloadDigest({ ...value }));
});

test("private artifact is non-overwriting and detects tampering", async () => {
  const store = new Map(), fakeStat = { isDirectory: () => true, isFile: () => true, isSymbolicLink: () => false, size: 0 };
  const handles = new Map();
  const openImpl = async (path, mode) => {
    if (mode === "wx" && store.has(path)) { const error = new Error(); error.code = "EEXIST"; throw error; }
    let text = store.get(path) || "";
    let cursor = 0;
    const handle = { writeFile: async (value) => { text = value; }, sync: async () => {}, close: async () => { if (mode === "wx") store.set(path, text); },
      stat: async () => ({ ...fakeStat, size: Buffer.byteLength(store.get(path) || "") }), read: async (buffer, offset, length) => { const source = Buffer.from(store.get(path) || ""); const count = source.copy(buffer, offset, cursor, cursor + length); cursor += count; return { bytesRead: count }; } };
    handles.set(path, handle); return handle;
  };
  const opts = { repositoryRoot: "C:\\repo", driveTypeImpl: async () => "Fixed", realpathImpl: async (p) => p,
    lstatImpl: async (p) => { if (store.has(p) || p !== "D:\\private\\one.json") return fakeStat; const e = new Error(); e.code = "ENOENT"; throw e; },
    openImpl, secureAccessImpl: async () => {}, linkImpl: async (source, target) => { if (store.has(target)) { const e = new Error(); e.code = "EEXIST"; throw e; } store.set(target, store.get(source)); },
  };
  const created = await writeNewPrivateArtifact("D:\\private\\one.json", "test-artifact", { safe: true }, opts);
  assert.match(created.artifactSha256, /^[0-9a-f]{64}$/u);
  await assert.rejects(writeNewPrivateArtifact("D:\\private\\one.json", "test-artifact", { safe: true }, opts));
  store.set("D:\\private\\one.json", `${store.get("D:\\private\\one.json")}x`);
  await assert.rejects(readPrivateArtifact("D:\\private\\one.json", "test-artifact", opts));
});

test("private path rejects repository paths and symlink or junction-like ancestors", async () => {
  const directory = { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false };
  const linked = { ...directory, isSymbolicLink: () => true };
  const commonOptions = { repositoryRoot: "C:\\repo", driveTypeImpl: async () => "Fixed", realpathImpl: async (value) => value };
  await assert.rejects(validatePrivateArtifactPath("C:\\repo\\snapshot.json", { ...commonOptions, lstatImpl: async () => directory }));
  await assert.rejects(validatePrivateArtifactPath("D:\\private\\snapshot.json", { ...commonOptions,
    lstatImpl: async (value) => value === "D:\\private" ? linked : directory }));
});

test("real concurrent filesystem lock acquisition has exactly one winner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "airguard-repair-lock-"));
  const lockPath = join(directory, "repair.lock");
  const options = { repositoryRoot: process.cwd(), driveTypeImpl: async () => "Fixed", secureAccessImpl: (path) => chmod(path, 0o600) };
  try {
    const attempts = await Promise.allSettled([
      acquirePrivateLifecycleLock(lockPath, "apply", options),
      acquirePrivateLifecycleLock(lockPath, "apply", options),
    ]);
    const winners = attempts.filter((item) => item.status === "fulfilled");
    assert.equal(winners.length, 1);
    assert.deepEqual(await readdir(directory), ["repair.lock"]);
    await assert.rejects(acquirePrivateLifecycleLock(lockPath, "apply", options));
    assert.deepEqual(await readdir(directory), ["repair.lock"]);
    await winners[0].value.release();
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("lock owner cleans its exact completed file after access-control failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "airguard-repair-lock-failure-"));
  const lockPath = join(directory, "repair.lock");
  try {
    await assert.rejects(acquirePrivateLifecycleLock(lockPath, "prepare", { repositoryRoot: process.cwd(),
      driveTypeImpl: async () => "Fixed", secureAccessImpl: async () => { throw new Error("synthetic-acl"); } }));
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("concurrent apply loser stops before Admin and repair artifact access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "airguard-repair-execution-lock-"));
  const snapshotPath = join(directory, "snapshot.json");
  const args = applyArgs.map((value, index, all) => all[index - 1] === "--snapshot-file" ? snapshotPath : value);
  const lockOptions = { repositoryRoot: process.cwd(), driveTypeImpl: async () => "Fixed", secureAccessImpl: (path) => chmod(path, 0o600) };
  let adminCalls = 0, artifactReads = 0, artifactWrites = 0, startAdmin, continueAdmin;
  const adminStarted = new Promise((resolveStarted) => { startAdmin = resolveStarted; });
  const adminMayContinue = new Promise((resolveContinue) => { continueAdmin = resolveContinue; });
  const dependencies = {
    guard: async () => true,
    validateArtifactPath: async (path) => path,
    acquireLock: (path, scope) => acquirePrivateLifecycleLock(path, scope, lockOptions),
    adminFactory: async () => { adminCalls += 1; startAdmin(); await adminMayContinue; return { app: {}, firestore: {}, FieldValue: {}, factories: {} }; },
    readArtifact: async () => { artifactReads += 1; throw new Error("synthetic-stop"); },
    writeArtifact: async () => { artifactWrites += 1; throw new Error("must-not-write"); },
    cleanup: async () => {},
  };
  try {
    const winner = executeApplyRepair({ args, dependencies });
    await adminStarted;
    const loser = await executeApplyRepair({ args, dependencies });
    assert.equal(loser.exitCode, 3); assert.equal(loser.summary.code, "lifecycle-locked");
    assert.deepEqual([adminCalls, artifactReads, artifactWrites], [1, 0, 0]);
    assert.deepEqual(await readdir(directory), ["snapshot.json.lock"]);
    continueAdmin(); await winner;
    assert.deepEqual(await readdir(directory), []);
  } finally { continueAdmin(); await rm(directory, { recursive: true, force: true }); }
});

test("actual repository root is enforced even when cwd is elsewhere", async () => {
  const directory = await mkdtemp(join(tmpdir(), "airguard-repair-cwd-"));
  const original = process.cwd(); let adminCalls = 0;
  try {
    process.chdir(directory);
    const insideRepository = join(OPERATION_REPAIR_ROOT, "forbidden-private-snapshot.json");
    const args = applyArgs.map((value, index, all) => all[index - 1] === "--snapshot-file" ? insideRepository : value);
    const result = await executeApplyRepair({ args, dependencies: { guard: async () => true, adminFactory: async () => { adminCalls += 1; } } });
    assert.equal(result.exitCode, 78); assert.equal(result.summary.code, "target-rejected"); assert.equal(adminCalls, 0);
  } finally { process.chdir(original); await rm(directory, { recursive: true, force: true }); }
});

const write = (index, companyId = "company-a") => {
  const beforeData = { docId: `doc-${index}` };
  return { companyId, projection: "Billings",
    path: `Companies/${companyId}/Billings/doc-${String(index).padStart(3, "0")}`, action: index % 2 ? "create" : "update",
    before: index % 2 ? null : { updateTime: { seconds: 1, nanoseconds: index }, dataDigest: canonicalProjectionDigest(beforeData), data: beforeData },
    expected: { docId: `doc-${index}`, manual: { preserved: true }, stamp: { seconds: 1, nanoseconds: index, toDate() { return new Date(1000); } } }, sourceDependencies: [] };
};

test("batching is deterministic, company isolated, <=50 and <=4MiB", () => {
  const writes = Array.from({ length: 121 }, (_, i) => write(i, i < 60 ? "company-a" : "company-b")).reverse();
  const batches = buildRepairBatches(writes);
  assert.deepEqual(batches.map((batch) => batch.writes.length), [50, 10, 50, 11]);
  assert(batches.every((batch) => batch.writes.length <= 50 && batch.bytes <= 4 * 1024 * 1024 && batch.writes.every((w) => w.companyId === batch.companyId)));
  assert.throws(() => buildRepairBatches([write(1), write(1)]));
});

test("backup guard validates internal digests, commit and exact 344 writes", () => {
  const writes = []; let index = 0;
  for (const [projection, counts] of Object.entries(REPAIR_COUNTS.perProjection)) {
    for (let i = 0; i < counts.create; i += 1) { index += 1; writes.push({ ...write(index * 2 + 1), projection, path: `Companies/company-a/${projection}/doc-${index}`, action: "create", before: null }); }
    for (let i = 0; i < counts.update; i += 1) { index += 1; writes.push({ ...write(index * 2), projection, path: `Companies/company-a/${projection}/doc-${index}`, action: "update" }); }
  }
  const perProjection = Object.fromEntries(Object.entries(REPAIR_COUNTS.perProjection).map(([name, counts]) => [name, { ...counts }]));
  const sources = [], targets = writes.filter((item) => item.action === "update").map((item) => ({ path: item.path, ...item.before }));
  const planDigest = canonicalProjectionDigest(writes.map(({ before, ...item }) => ({ ...item, before: before && { updateTime: before.updateTime, dataDigest: before.dataDigest } })));
  const payload = { schemaVersion: 1, target: { project: "air-guard-v2-dev", database: "(default)", branch: "main" }, expectedCommit: commit,
    dates: { start: "2026-09-05", end: "2026-09-14" }, limits: {},
    writePlanDigest: planDigest, sourceDigest: canonicalProjectionDigest(sources), beforeDigest: canonicalProjectionDigest(targets),
    counts: { write: 344, create: 250, update: 94, extra: 1, blocked: 0, perProjection },
    companyPlans: ["a", "b", "c", "d"].map((id) => ({ companyId: `company-${id}`, planDigest: sha })), sources, targets, writes };
  const options = { ...parseApplyRepairArgs(applyArgs), snapshotSha256: sha, planDigest: sha };
  assert.equal(validateApplyArtifacts({ options, snapshotArtifact: { artifactSha256: sha, payload } }).writes.length, 344);
  assert.throws(() => validateApplyArtifacts({ options: { ...options, expectedCommit: "c".repeat(40) }, snapshotArtifact: { artifactSha256: sha, payload } }));
});

test("normal apply never deletes and rollback deletes only prior creates", async () => {
  const calls = [], snapshots = new Map();
  const batch = buildRepairBatches([write(1)] )[0];
  const transaction = { get: async (ref) => snapshots.get(ref.path) || { exists: false }, create: (ref, data) => calls.push(["create", ref.path, data]),
    set: (ref, data) => calls.push(["set", ref.path, data]), delete: (ref) => calls.push(["delete", ref.path]) };
  const firestore = { doc: (path) => ({ path }), runTransaction: async (fn) => fn(transaction) };
  await commitApplyBatch({ firestore, FieldValue: { serverTimestamp: () => ({ sentinel: true }) }, batch });
  assert.deepEqual(calls.map(([kind]) => kind), ["create"]);
  assert.deepEqual(calls[0][2].manual, { preserved: true });
  assert.equal(calls[0][2].stamp.nanoseconds, 1);
  calls.length = 0; snapshots.set(batch.writes[0].path, { exists: true, updateTime: { seconds: 9, nanoseconds: 1 }, data: () => ({ done: true }) });
  await commitRollbackBatch({ firestore, batch, post: [{ path: batch.writes[0].path, updateTime: { seconds: 9, nanoseconds: 1 }, dataDigest: privateArtifactPayloadDigest({ done: true }) }] });
  assert.deepEqual(calls.map(([kind]) => kind), ["delete"]);
});

test("crash reconciliation distinguishes before, applied and ambiguous states", async () => {
  const batch = buildRepairBatches([write(1), write(3)])[0], documents = new Map();
  const firestore = { doc: (path) => ({ path, get: async () => documents.get(path) || { exists: false } }) };
  assert.equal((await inspectBatchState({ firestore, batch })).state, "before");
  for (const item of batch.writes) documents.set(item.path, { exists: true, updateTime: { seconds: 9, nanoseconds: Number(item.path.endsWith("1")) },
    data: () => ({ ...item.expected, uid: "system", createdAt: { seconds: 9 }, updatedAt: { seconds: 9 } }) });
  const applied = await inspectBatchState({ firestore, batch }); assert.equal(applied.state, "after");
  assert.equal(await inspectRollbackState({ firestore, batch, post: applied.post }), "applied");
  documents.delete(batch.writes[0].path);
  assert.equal((await inspectBatchState({ firestore, batch })).state, "ambiguous");
  assert.equal(await inspectRollbackState({ firestore, batch, post: applied.post }), "ambiguous");
});

test("intent plus expected current data is not auto-adopted after a crash", async () => {
  const item = write(1), snapshot = { writes: [item] }, mutations = [];
  const current = { exists: true, updateTime: { seconds: 10, nanoseconds: 1 },
    data: () => ({ ...item.expected, uid: "system", createdAt: { seconds: 10 }, updatedAt: { seconds: 10 } }) };
  const firestore = { doc: (path) => ({ path, get: async () => current }) };
  const receipt = { state: "intent", batches: [{ state: "intent", post: [] }] };
  await assert.rejects(runApplyOrRollback({ options: { mode: "apply", receiptFile: "unused" }, snapshot, receipt,
    receiptState: {}, firestore, FieldValue: {}, dependencies: { replaceArtifact: async () => { mutations.push("receipt"); } }, repositoryRoot: process.cwd() }),
  (error) => error.code === "crash-state-ambiguous");
  assert.deepEqual(mutations, []);
});

test("receipt rejects impossible state and partial post combinations", () => {
  const writes = Array.from({ length: 101 }, (_, index) => write(index * 2 + 1));
  const batches = buildRepairBatches(writes);
  const snapshot = { writes };
  const options = { ...parseApplyRepairArgs(applyArgs), snapshotSha256: sha, planDigest: sha };
  const post = (batch) => batch.writes.map((item, index) => ({ path: item.path, updateTime: { seconds: 9, nanoseconds: index }, dataDigest: sha }));
  const receipt = (state, states) => ({ schemaVersion: 1, state, target: { project: "air-guard-v2-dev", database: "(default)", branch: "main" },
    expectedCommit: commit, snapshotSha256: sha, writePlanDigest: sha,
    batches: batches.map((batch, index) => ({ index, companyId: batch.companyId, state: states[index], post: ["committed", "verified", "rolled-back"].includes(states[index]) ? post(batch) : [] })) });
  assert.doesNotThrow(() => validateReceipt(receipt("intent", ["verified", "intent", "pending"]), snapshot, options));
  assert.doesNotThrow(() => validateReceipt(receipt("intent", ["verified", "committed", "pending"]), snapshot, options));
  assert.throws(() => validateReceipt(receipt("verified", ["verified", "pending", "pending"]), snapshot, options));
  assert.throws(() => validateReceipt(receipt("intent", ["pending", "verified", "pending"]), snapshot, options));
  const pendingPost = receipt("intent", ["pending", "pending", "pending"]); pendingPost.batches[0].post = post(batches[0]);
  assert.throws(() => validateReceipt(pendingPost, snapshot, options));
  const partialCommitted = receipt("intent", ["committed", "pending", "pending"]); partialCommitted.batches[0].post = [];
  assert.throws(() => validateReceipt(partialCommitted, snapshot, options));
  const missingPath = receipt("intent", ["committed", "pending", "pending"]); missingPath.batches[0].post[0].path = "Companies/company-a/Billings/not-the-write";
  assert.throws(() => validateReceipt(missingPath, snapshot, options));
  assert.throws(() => validateReceipt(receipt("rollback-intent", ["verified", "intent", "pending"]), snapshot, options));
  assert.throws(() => validateReceipt(receipt("rollback-intent", ["pending", "pending", "pending"]), snapshot, options));
  assert.doesNotThrow(() => validateReceipt(receipt("rollback-intent", ["verified", "rolled-back", "pending"]), snapshot, options));
  assert.throws(() => validateReceipt(receipt("rolled-back", ["pending", "pending", "pending"]), snapshot, options));
  assert.throws(() => validateReceipt(receipt("rolled-back", ["pending", "rolled-back", "pending"]), snapshot, options));
  assert.doesNotThrow(() => validateReceipt(receipt("rolled-back", ["rolled-back", "pending", "pending"]), snapshot, options));
});

test("missing mode and target mismatch initialize no admin and write nothing", async () => {
  let guards = 0, admins = 0, writes = 0;
  const dependencies = { guard: async () => { guards += 1; return true; }, adminFactory: async () => { admins += 1; }, writeArtifact: async () => { writes += 1; } };
  const missing = await executeApplyRepair({ args: applyArgs.slice(1), dependencies });
  assert.equal(missing.exitCode, 64); assert.deepEqual([guards, admins, writes], [0, 0, 0]);
  const wrong = [...applyArgs]; wrong[wrong.indexOf("air-guard-v2-dev")] = "production";
  const rejected = await executeApplyRepair({ args: wrong, dependencies });
  assert.equal(rejected.exitCode, 78); assert.deepEqual([guards, admins, writes], [0, 0, 0]);
});
