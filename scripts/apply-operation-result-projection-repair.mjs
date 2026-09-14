import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { canonicalizeProjectionValue, canonicalProjectionDigest, projectionValuesEqual } from "./lib/operation-result-projection-plan.mjs";
import { acquirePrivateLifecycleLock, privateArtifactExists, readPrivateArtifact, replacePrivateArtifact, validatePrivateArtifactPath, writeNewPrivateArtifact } from "./lib/private-firestore-receipt.mjs";
import { createRepairAdmin, guardRepairRuntime, REPAIR_COUNTS, REPAIR_TARGET } from "./prepare-operation-result-projection-repair.mjs";

const MAX_WRITES = 50;
const MAX_BYTES = 4 * 1024 * 1024;
export const OPERATION_REPAIR_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
class ApplyError extends Error { constructor(code, exitCode = 3) { super(code); this.code = code; this.exitCode = exitCode; } }
const fail = (code, exitCode) => { throw new ApplyError(code, exitCode); };
const sha = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const safeSegment = (value) => typeof value === "string" && value.length > 0 && value.length <= 1500 && value === value.trim() && !/[\/\u0000-\u001f\u007f]/u.test(value);
const validRevision = (value) => value && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1000000000;
const validFirestoreTimestamp = (value) => {
  if (!validRevision(value) || typeof value.toDate !== "function") return false;
  try { return value.toDate() instanceof Date && Number.isFinite(value.toDate().getTime()); } catch { return false; }
};
const sameRevision = (actual, expected) => actual && expected && actual.seconds === expected.seconds && actual.nanoseconds === expected.nanoseconds;
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));

const VALUE_ARGS = Object.freeze({
  "--project": "project", "--database": "database", "--snapshot-file": "snapshotFile",
  "--expected-commit": "expectedCommit",
});

export function parseApplyRepairArgs(args) {
  if (!Array.isArray(args)) fail("arguments", 64);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    if (["--apply", "--rollback"].includes(args[i])) { if (out.mode) fail("arguments", 64); out.mode = args[i].slice(2); continue; }
    const field = VALUE_ARGS[args[i]], value = args[++i];
    if (!field || Object.hasOwn(out, field) || typeof value !== "string" || value.startsWith("--")) fail("arguments", 64);
    out[field] = value;
  }
  if (!out.mode || Object.values(VALUE_ARGS).some((field) => !Object.hasOwn(out, field))) fail("arguments", 64);
  if (out.project !== REPAIR_TARGET.project || out.database !== REPAIR_TARGET.database || !/^[0-9a-f]{40}$/u.test(out.expectedCommit)) fail("target-rejected", 78);
  return { ...out, receiptFile: `${out.snapshotFile}.receipt`, lockFile: `${out.snapshotFile}.lock` };
}

function payloadBytes(write) { return Buffer.byteLength(JSON.stringify(canonicalizeProjectionValue(write))); }
export function buildRepairBatches(writes, { maxWrites = MAX_WRITES, maxBytes = MAX_BYTES } = {}) {
  if (!Array.isArray(writes) || !Number.isInteger(maxWrites) || maxWrites < 1 || maxWrites > MAX_WRITES || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) fail("batch-invalid");
  const sorted = [...writes].sort((a, b) => a.companyId.localeCompare(b.companyId) || a.path.localeCompare(b.path));
  const paths = new Set(), batches = []; let batch = null;
  for (const write of sorted) {
    if (!exactKeys(write, ["companyId", "projection", "path", "action", "before", "expected", "sourceDependencies"]) ||
        !["create", "update"].includes(write.action) || paths.has(write.path) ||
        !write.path.startsWith(`Companies/${write.companyId}/${write.projection}/`) || write.path.split("/").length !== 4) fail("write-plan-invalid");
    paths.add(write.path); const bytes = payloadBytes(write); if (bytes > maxBytes) fail("batch-size");
    if (!batch || batch.companyId !== write.companyId || batch.writes.length >= maxWrites || batch.bytes + bytes > maxBytes) {
      batch = { index: batches.length, companyId: write.companyId, bytes: 0, writes: [] }; batches.push(batch);
    }
    batch.writes.push(write); batch.bytes += bytes;
  }
  return batches;
}

export function validateApplyArtifacts({ options, snapshotArtifact }) {
  const snapshot = snapshotArtifact.payload;
  if (!exactKeys(snapshot, ["schemaVersion", "target", "expectedCommit", "dates", "limits", "counts", "companyPlans", "sourceDigest", "beforeDigest", "writePlanDigest", "sources", "targets", "writes"]) ||
      !exactKeys(snapshot.target, ["project", "database", "branch"]) || snapshot.schemaVersion !== 1 ||
      snapshot.expectedCommit !== options.expectedCommit ||
      snapshot.target?.project !== options.project || snapshot.target?.database !== options.database ||
      snapshot.target?.branch !== REPAIR_TARGET.branch || snapshot.counts?.write !== REPAIR_COUNTS.write ||
      !Array.isArray(snapshot.writes) || snapshot.writes.length !== REPAIR_COUNTS.write || !Array.isArray(snapshot.sources) ||
      !Array.isArray(snapshot.targets) || !Array.isArray(snapshot.companyPlans) || snapshot.companyPlans.length !== 4 ||
      !sha(snapshot.sourceDigest) || !sha(snapshot.beforeDigest) ||
      canonicalProjectionDigest(snapshot.sources) !== snapshot.sourceDigest || canonicalProjectionDigest(snapshot.targets) !== snapshot.beforeDigest) fail("artifact-mismatch", 78);
  const companyIds = new Set(snapshot.companyPlans.map((item) => item.companyId));
  if (companyIds.size !== 4 || snapshot.companyPlans.some((item) => !exactKeys(item, ["companyId", "planDigest"]) || !safeSegment(item.companyId) || !sha(item.planDigest))) fail("artifact-mismatch", 78);
  const sourcePaths = new Set();
  for (const source of snapshot.sources) {
    const segments = source?.path?.split("/");
    if (!source || !Array.isArray(segments) || segments.length !== 4 || segments[0] !== "Companies" || !companyIds.has(segments[1]) || segments[2] !== "OperationResults" ||
        !safeSegment(segments[3]) || sourcePaths.has(source.path) || !validRevision(source.updateTime) || !sha(source.dataDigest) || canonicalProjectionDigest(source.data) !== source.dataDigest) fail("artifact-mismatch", 78);
    sourcePaths.add(source.path);
  }
  const targetByPath = new Map();
  for (const target of snapshot.targets) {
    const segments = target?.path?.split("/");
    if (!exactKeys(target, ["path", "updateTime", "dataDigest", "data"]) || !Array.isArray(segments) || segments.length !== 4 || segments[0] !== "Companies" || !companyIds.has(segments[1]) ||
        !Object.hasOwn(REPAIR_COUNTS.perProjection, segments[2]) || !safeSegment(segments[3]) || targetByPath.has(target.path) || !validRevision(target.updateTime) ||
        !sha(target.dataDigest) || canonicalProjectionDigest(target.data) !== target.dataDigest) fail("artifact-mismatch", 78);
    targetByPath.set(target.path, target);
  }
  const paths = new Set(), referencedSources = new Set(); const actual = { create: 0, update: 0, extra: snapshot.counts.extra, blocked: snapshot.counts.blocked, perProjection: {} };
  for (const write of snapshot.writes) {
    if (!exactKeys(write, ["companyId", "projection", "path", "action", "before", "expected", "sourceDependencies"]) || !companyIds.has(write.companyId) || paths.has(write.path) || !["create", "update"].includes(write.action) || !Object.hasOwn(REPAIR_COUNTS.perProjection, write.projection) ||
        !write.path.startsWith(`Companies/${write.companyId}/${write.projection}/`) || !Array.isArray(write.sourceDependencies) ||
        write.sourceDependencies.some((dep) => !exactKeys(dep, ["path", "updateTime", "dataDigest"]) || !validRevision(dep.updateTime) || !sha(dep.dataDigest) || !sourcePaths.has(dep.path) || !dep.path.startsWith(`Companies/${write.companyId}/OperationResults/`))) fail("artifact-mismatch", 78);
    for (const dependency of write.sourceDependencies) referencedSources.add(dependency.path);
    if (write.action === "create" ? write.before !== null || targetByPath.has(write.path) :
      !write.before || !validRevision(write.before.updateTime) || canonicalProjectionDigest(write.before.data) !== write.before.dataDigest ||
      !projectionValuesEqual(targetByPath.get(write.path), { path: write.path, ...write.before })) fail("artifact-mismatch", 78);
    paths.add(write.path); actual[write.action] += 1; actual.perProjection[write.projection] ||= { create: 0, update: 0, extra: 0 };
    actual.perProjection[write.projection][write.action] += 1;
  }
  if (actual.create !== REPAIR_COUNTS.create || actual.update !== REPAIR_COUNTS.update || snapshot.targets.length !== actual.update ||
      referencedSources.size !== sourcePaths.size || [...sourcePaths].some((path) => !referencedSources.has(path)) || snapshot.counts.extra !== 1 || snapshot.counts.blocked !== 0) fail("artifact-mismatch", 78);
  for (const [projection, expected] of Object.entries(REPAIR_COUNTS.perProjection)) {
    const got = actual.perProjection[projection] || { create: 0, update: 0, extra: 0 }; got.extra = snapshot.counts.perProjection?.[projection]?.extra;
    if (JSON.stringify(got) !== JSON.stringify(expected)) fail("artifact-mismatch", 78);
  }
  const calculatedPlanDigest = canonicalProjectionDigest(snapshot.writes.map(({ before, ...write }) => ({ ...write,
    before: before && { updateTime: before.updateTime, dataDigest: before.dataDigest } })));
  if (calculatedPlanDigest !== snapshot.writePlanDigest) fail("artifact-mismatch", 78);
  return snapshot;
}

export function validateReceipt(receipt, snapshot, options) {
  if (!exactKeys(receipt, ["schemaVersion", "state", "target", "expectedCommit", "snapshotSha256", "writePlanDigest", "batches"]) ||
      !exactKeys(receipt?.target, ["project", "database", "branch"]) ||
      receipt.schemaVersion !== 1 || !["intent", "verified", "rollback-intent", "rolled-back"].includes(receipt.state) ||
      receipt.target?.project !== options.project || receipt.target?.database !== options.database ||
      receipt.target?.branch !== REPAIR_TARGET.branch ||
      receipt.snapshotSha256 !== options.snapshotSha256 || receipt.writePlanDigest !== options.planDigest ||
      receipt.expectedCommit !== options.expectedCommit || !Array.isArray(receipt.batches)) fail("receipt-mismatch", 78);
  const batches = buildRepairBatches(snapshot.writes);
  if (receipt.batches.length !== batches.length) fail("receipt-mismatch", 78);
  for (let index = 0; index < batches.length; index += 1) {
    const entry = receipt.batches[index];
    if (!exactKeys(entry, ["index", "companyId", "state", "post"]) || entry.index !== index || entry.companyId !== batches[index].companyId ||
        !["pending", "intent", "committed", "verified", "rolled-back"].includes(entry.state) || !Array.isArray(entry.post)) fail("receipt-mismatch", 78);
    const paths = new Set(), expectedPaths = new Set(batches[index].writes.map((write) => write.path));
    for (const post of entry.post) {
      if (!exactKeys(post, ["path", "updateTime", "dataDigest"]) || paths.has(post.path) || !batches[index].writes.some((write) => write.path === post.path) || !validRevision(post.updateTime) || !sha(post.dataDigest)) fail("receipt-mismatch", 78);
      paths.add(post.path);
    }
    if (["pending", "intent"].includes(entry.state) && entry.post.length !== 0) fail("receipt-mismatch", 78);
    if (["committed", "verified", "rolled-back"].includes(entry.state) &&
        (paths.size !== expectedPaths.size || [...expectedPaths].some((path) => !paths.has(path)))) fail("receipt-mismatch", 78);
  }
  const states = receipt.batches.map((entry) => entry.state);
  if (receipt.state === "verified" && states.some((state) => state !== "verified")) fail("receipt-mismatch", 78);
  if (receipt.state === "rolled-back" && states.some((state) => !["rolled-back", "pending"].includes(state))) fail("receipt-mismatch", 78);
  if (receipt.state === "rolled-back") {
    if (!states.includes("rolled-back")) fail("receipt-mismatch", 78);
    let pending = false;
    for (const state of states) {
      if (state === "pending") pending = true;
      else if (state !== "rolled-back" || pending) fail("receipt-mismatch", 78);
    }
  }
  if (receipt.state === "intent") {
    let phase = "verified", active = 0;
    for (const state of states) {
      if (state === "verified" && phase === "verified") continue;
      if (["intent", "committed"].includes(state) && phase === "verified" && active === 0) { active += 1; phase = "active"; continue; }
      if (state === "pending" && ["verified", "active", "pending"].includes(phase)) { phase = "pending"; continue; }
      fail("receipt-mismatch", 78);
    }
  }
  if (receipt.state === "rollback-intent") {
    if (states.every((state) => state === "pending")) fail("receipt-mismatch", 78);
    let phase = "applied";
    for (const state of states) {
      if (["verified", "committed"].includes(state) && phase === "applied") continue;
      if (state === "rolled-back" && ["applied", "rolled-back"].includes(phase)) { phase = "rolled-back"; continue; }
      if (state === "pending" && ["applied", "rolled-back", "pending"].includes(phase)) { phase = "pending"; continue; }
      fail("receipt-mismatch", 78);
    }
  }
}

function expectedWithRuntimeFields(write, FieldValue) {
  const payload = { ...write.expected, updatedAt: FieldValue.serverTimestamp() };
  if (write.action === "create") { payload.createdAt = FieldValue.serverTimestamp(); payload.uid = "system"; }
  return payload;
}
function verifyAppliedData(write, data) {
  if (write.action === "create") {
    const { updatedAt, createdAt, uid, ...current } = data;
    const { updatedAt: _expectedUpdatedAt, createdAt: _expectedCreatedAt, uid: _expectedUid, ...expected } = write.expected;
    return validFirestoreTimestamp(createdAt) && validFirestoreTimestamp(updatedAt) && uid === "system" && projectionValuesEqual(current, expected);
  }
  const { updatedAt, ...rest } = data;
  const { updatedAt: _expectedUpdatedAt, ...expected } = write.expected;
  return validFirestoreTimestamp(updatedAt) && projectionValuesEqual(rest, expected);
}

async function readAndCheck(transaction, firestore, write, mode) {
  const target = firestore.doc(write.path);
  const dependencies = await Promise.all(write.sourceDependencies.map(async (dependency) => {
    const snapshot = await transaction.get(firestore.doc(dependency.path));
    if (!snapshot.exists || !sameRevision(snapshot.updateTime, dependency.updateTime) || canonicalProjectionDigest(snapshot.data()) !== dependency.dataDigest) fail("source-changed");
    return snapshot;
  }));
  const current = await transaction.get(target);
  if (mode === "apply") {
    if (write.action === "create" && current.exists) fail("target-changed");
    if (write.action === "update" && (!current.exists || !sameRevision(current.updateTime, write.before?.updateTime) || canonicalProjectionDigest(current.data()) !== write.before?.dataDigest)) fail("target-changed");
  }
  return { target, current, dependencies };
}

export async function commitApplyBatch({ firestore, FieldValue, batch }) {
  await firestore.runTransaction(async (transaction) => {
    const checked = [];
    for (const write of batch.writes) checked.push({ write, ...(await readAndCheck(transaction, firestore, write, "apply")) });
    for (const { write, target } of checked) {
      const payload = expectedWithRuntimeFields(write, FieldValue);
      if (write.action === "create") transaction.create(target, payload); else transaction.set(target, payload);
    }
  });
}

export async function inspectBatchState({ firestore, batch }) {
  let before = 0, after = 0;
  const post = [];
  for (const write of batch.writes) {
    const snapshot = await firestore.doc(write.path).get();
    const isBefore = write.action === "create" ? !snapshot.exists : snapshot.exists && sameRevision(snapshot.updateTime, write.before?.updateTime) && canonicalProjectionDigest(snapshot.data()) === write.before?.dataDigest;
    const isAfter = snapshot.exists && verifyAppliedData(write, snapshot.data());
    if (isBefore) before += 1; if (isAfter) { after += 1; post.push({ path: write.path, updateTime: { seconds: snapshot.updateTime.seconds, nanoseconds: snapshot.updateTime.nanoseconds }, dataDigest: canonicalProjectionDigest(snapshot.data()) }); }
  }
  if (before === batch.writes.length) return { state: "before", post: [] };
  if (after === batch.writes.length) return { state: "after", post };
  return { state: "ambiguous", post: [] };
}

export async function commitRollbackBatch({ firestore, batch, post }) {
  const postByPath = new Map(post.map((item) => [item.path, item]));
  await firestore.runTransaction(async (transaction) => {
    const checked = [];
    for (const write of [...batch.writes].reverse()) {
      const current = await transaction.get(firestore.doc(write.path)), expected = postByPath.get(write.path);
      if (!current.exists || !expected || !sameRevision(current.updateTime, expected.updateTime) || canonicalProjectionDigest(current.data()) !== expected.dataDigest) fail("rollback-target-changed");
      checked.push({ write, ref: firestore.doc(write.path) });
    }
    for (const { write, ref } of checked) {
      if (write.action === "create") transaction.delete(ref); else transaction.set(ref, write.before.data);
    }
  });
}

export async function inspectRollbackState({ firestore, batch, post }) {
  const postByPath = new Map(post.map((item) => [item.path, item])); let restored = 0, applied = 0;
  for (const write of batch.writes) {
    const snapshot = await firestore.doc(write.path).get(), expectedPost = postByPath.get(write.path);
    const isRestored = write.action === "create" ? !snapshot.exists : snapshot.exists && canonicalProjectionDigest(snapshot.data()) === write.before.dataDigest;
    const isApplied = snapshot.exists && expectedPost && sameRevision(snapshot.updateTime, expectedPost.updateTime) && canonicalProjectionDigest(snapshot.data()) === expectedPost.dataDigest;
    if (isRestored) restored += 1; if (isApplied) applied += 1;
  }
  if (restored === batch.writes.length) return "restored";
  if (applied === batch.writes.length) return "applied";
  return "ambiguous";
}

function newReceipt(snapshot, batches, options) { return { schemaVersion: 1, state: "intent", target: REPAIR_TARGET,
  expectedCommit: options.expectedCommit, snapshotSha256: options.snapshotSha256, writePlanDigest: options.planDigest,
  batches: batches.map((batch) => ({ index: batch.index, companyId: batch.companyId, state: "pending", post: [] })) }; }

async function saveReceipt(path, receipt, state, dependencies, repositoryRoot) {
  const result = await (dependencies.replaceArtifact || replacePrivateArtifact)(path, "operation-result-projection-receipt", receipt, state.artifactSha256, { repositoryRoot });
  state.artifactSha256 = result.artifactSha256;
}

function exactPost(entry, observed) {
  if (entry.post.length !== observed.post.length) return false;
  const expected = new Map(entry.post.map((item) => [item.path, item]));
  return observed.post.every((item) => {
    const prior = expected.get(item.path);
    return prior && sameRevision(item.updateTime, prior.updateTime) && item.dataDigest === prior.dataDigest;
  });
}

export async function runApplyOrRollback({ options, snapshot, receipt, receiptState, firestore, FieldValue, dependencies, repositoryRoot }) {
  const batches = buildRepairBatches(snapshot.writes);
  if (options.mode === "apply") {
    if (!["intent", "verified"].includes(receipt.state)) fail("receipt-terminal");
    for (const batch of batches) {
      const entry = receipt.batches[batch.index];
      if (entry.state === "verified") {
        const observed = await inspectBatchState({ firestore, batch });
        if (observed.state !== "after" || !exactPost(entry, observed)) fail("resume-post-changed");
        continue;
      }
      if (entry.state === "rolled-back") fail("receipt-terminal");
      const observed = await inspectBatchState({ firestore, batch });
      if (observed.state === "ambiguous") fail("crash-state-ambiguous");
      if (entry.state === "committed") {
        if (observed.state !== "after" || !exactPost(entry, observed)) fail("resume-post-changed");
        entry.state = "verified"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
        continue;
      }
      if (observed.state === "after") {
        if (entry.state !== "intent") fail("crash-state-ambiguous");
        entry.state = "committed"; entry.post = observed.post; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
        entry.state = "verified"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
        continue;
      }
      if (observed.state === "before") {
        entry.state = "intent"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
        await commitApplyBatch({ firestore, FieldValue, batch });
      }
      const applied = await inspectBatchState({ firestore, batch }); if (applied.state !== "after") fail("apply-verification");
      entry.state = "committed"; entry.post = applied.post; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
      entry.state = "verified"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
    }
    receipt.state = "verified"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot); return;
  }
  if (receipt.state === "rolled-back") return;
  if (!receipt.batches.some((entry) => ["committed", "verified"].includes(entry.state))) fail("rollback-empty");
  if (receipt.batches.some((entry) => entry.state === "intent")) fail("rollback-crash-ambiguous");
  receipt.state = "rollback-intent"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
  for (const batch of [...batches].reverse()) {
    const entry = receipt.batches[batch.index];
    if (entry.state === "rolled-back" || entry.state === "pending") continue;
    if (!Array.isArray(entry.post) || entry.post.length !== batch.writes.length) fail("rollback-receipt");
    const observed = await inspectRollbackState({ firestore, batch, post: entry.post });
    if (observed === "ambiguous") fail("rollback-state-ambiguous");
    if (observed === "applied") await commitRollbackBatch({ firestore, batch, post: entry.post });
    if (await inspectRollbackState({ firestore, batch, post: entry.post }) !== "restored") fail("rollback-verification");
    entry.state = "rolled-back"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
  }
  receipt.state = "rolled-back"; await saveReceipt(options.receiptFile, receipt, receiptState, dependencies, repositoryRoot);
}

export async function executeApplyRepair({ args = [], env = {}, repositoryRoot = OPERATION_REPAIR_ROOT, dependencies = {} } = {}) {
  let app = null, admin = null, lifecycleLock = null, outcome = null;
  try {
    const options = parseApplyRepairArgs(args); if (await (dependencies.guard || guardRepairRuntime)(options, env) === false) fail("target-rejected", 78);
    const validatePath = dependencies.validateArtifactPath || validatePrivateArtifactPath;
    await validatePath(options.snapshotFile, { repositoryRoot, allowExisting: true });
    await validatePath(options.receiptFile, { repositoryRoot, allowExisting: true });
    lifecycleLock = await (dependencies.acquireLock || acquirePrivateLifecycleLock)(options.lockFile, options.mode, { repositoryRoot });
    admin = await (dependencies.adminFactory || ((o) => createRepairAdmin(o, env)))(options); if (!admin) fail("target-rejected", 78);
    app = admin.app;
    const factories = dependencies.factories || admin.factories;
    const snapshotArtifact = await (dependencies.readArtifact || readPrivateArtifact)(options.snapshotFile, "operation-result-projection-snapshot", { repositoryRoot, factories });
    const snapshot = validateApplyArtifacts({ options, snapshotArtifact });
    options.snapshotSha256 = snapshotArtifact.artifactSha256; options.planDigest = snapshot.writePlanDigest;
    const firestore = admin.firestore;
    let receipt, receiptState;
    if (options.mode === "apply") {
      const exists = await (dependencies.artifactExists || privateArtifactExists)(options.receiptFile, { repositoryRoot });
      if (exists) {
        const existing = await (dependencies.readArtifact || readPrivateArtifact)(options.receiptFile, "operation-result-projection-receipt", { repositoryRoot, factories });
        receipt = existing.payload; receiptState = { artifactSha256: existing.artifactSha256 };
      } else {
        receipt = newReceipt(snapshot, buildRepairBatches(snapshot.writes), options);
        receiptState = await (dependencies.writeArtifact || writeNewPrivateArtifact)(options.receiptFile, "operation-result-projection-receipt", receipt, { repositoryRoot });
      }
    } else {
      const existing = await (dependencies.readArtifact || readPrivateArtifact)(options.receiptFile, "operation-result-projection-receipt", { repositoryRoot, factories });
      receipt = existing.payload; receiptState = { artifactSha256: existing.artifactSha256 };
    }
    validateReceipt(receipt, snapshot, options);
    await runApplyOrRollback({ options, snapshot, receipt, receiptState, firestore, FieldValue: admin.FieldValue, dependencies, repositoryRoot });
    outcome = { exitCode: 0, summary: { status: options.mode === "apply" ? "applied" : "rolled-back", complete: true, project: options.project, database: options.database, writeCount: snapshot.writes.length } }; return outcome;
  } catch (error) {
    const locked = error?.code === "artifact-exists", badPath = error?.code === "artifact-path";
    outcome = { exitCode: error instanceof ApplyError ? error.exitCode : locked ? 3 : badPath ? 78 : 70,
      summary: { status: "blocked", complete: false, code: error instanceof ApplyError ? error.code : locked ? "lifecycle-locked" : badPath ? "target-rejected" : "unexpected" } }; return outcome;
  } finally {
    if (dependencies.cleanup) await dependencies.cleanup(app).catch(() => {});
    else if (app && admin?.deleteApp) await admin.deleteApp(app).catch(() => {});
    if (lifecycleLock) try { await lifecycleLock.release(); } catch {
      if (outcome) { outcome.exitCode = 70; outcome.summary = { status: "blocked", complete: false, code: "lock-release" }; }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await executeApplyRepair({ args: process.argv.slice(2), env: process.env, repositoryRoot: OPERATION_REPAIR_ROOT });
  process.stdout.write(`${JSON.stringify(result.summary)}\n`); process.exitCode = result.exitCode;
}
