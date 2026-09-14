import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmod, copyFile, lstat, open, realpath, rename, unlink,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, parse, resolve, win32 } from "node:path";
import { promisify } from "node:util";

export const PRIVATE_ARTIFACT_VERSION = 1;
export const PRIVATE_ARTIFACT_MAX_BYTES = 256 * 1024 * 1024;

class PrivateArtifactError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new PrivateArtifactError(code); };
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exactKeys = (value, keys) => plain(value) && Object.keys(value).length === keys.length &&
  Object.keys(value).every((key) => keys.includes(key));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function byteValue(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value?.toBase64 === "function") return Buffer.from(value.toBase64(), "base64");
  return null;
}

export function encodePrivateFirestoreValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return ["number", "nan"];
    if (value === Infinity) return ["number", "positive-infinity"];
    if (value === -Infinity) return ["number", "negative-infinity"];
    if (Object.is(value, -0)) return ["number", "negative-zero"];
    return value;
  }
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail("codec-date");
    return ["date", value.toISOString()];
  }
  if (Number.isInteger(value?.seconds) && Number.isInteger(value?.nanoseconds) &&
      typeof value?.toDate === "function") return ["timestamp", value.seconds, value.nanoseconds];
  const bytes = byteValue(value);
  if (bytes) return ["bytes", bytes.toString("base64")];
  if (typeof value?.latitude === "number" && typeof value?.longitude === "number" &&
      (value.constructor?.name === "GeoPoint" || typeof value?.isEqual === "function")) {
    return ["geo-point", value.latitude, value.longitude];
  }
  if (typeof value?.path === "string" &&
      (value.constructor?.name?.includes("DocumentReference") || value.firestore)) {
    return ["reference", value.path];
  }
  if (typeof value !== "object" || value === undefined) fail("codec-type");
  if (seen.has(value)) fail("codec-cycle");
  seen.add(value);
  try {
    if (Array.isArray(value)) return ["array", value.map((item) => encodePrivateFirestoreValue(item, seen))];
    if (!plain(value)) fail("codec-type");
    return ["map", Object.keys(value).sort().map((key) => [key, encodePrivateFirestoreValue(value[key], seen)])];
  } finally { seen.delete(value); }
}

function validReferencePath(path) {
  if (typeof path !== "string" || path.length === 0 || /[\u0000-\u001f\u007f]/u.test(path)) return false;
  const segments = path.split("/");
  return segments.length % 2 === 0 && segments.every((segment) => segment.length > 0);
}

export function decodePrivateFirestoreValue(value, factories = {}) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (!Array.isArray(value) || typeof value[0] !== "string") fail("codec-shape");
  const [tag, ...parts] = value;
  if (tag === "number" && parts.length === 1) {
    return { nan: NaN, "positive-infinity": Infinity, "negative-infinity": -Infinity,
      "negative-zero": -0 }[parts[0]] ?? fail("codec-number");
  }
  if (tag === "date" && parts.length === 1 && typeof parts[0] === "string") {
    const date = new Date(parts[0]);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== parts[0]) fail("codec-date");
    return date;
  }
  if (tag === "timestamp" && parts.length === 2 && Number.isInteger(parts[0]) &&
      Number.isInteger(parts[1]) && parts[1] >= 0 && parts[1] < 1000000000 && factories.Timestamp) {
    return new factories.Timestamp(parts[0], parts[1]);
  }
  if (tag === "bytes" && parts.length === 1 && typeof parts[0] === "string" &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(parts[0])) {
    return Buffer.from(parts[0], "base64");
  }
  if (tag === "geo-point" && parts.length === 2 && parts.every(Number.isFinite) && factories.GeoPoint) {
    return new factories.GeoPoint(parts[0], parts[1]);
  }
  if (tag === "reference" && parts.length === 1 && validReferencePath(parts[0]) && factories.reference) {
    return factories.reference(parts[0]);
  }
  if (tag === "array" && parts.length === 1 && Array.isArray(parts[0])) {
    return parts[0].map((item) => decodePrivateFirestoreValue(item, factories));
  }
  if (tag === "map" && parts.length === 1 && Array.isArray(parts[0])) {
    const output = {};
    let prior = null;
    for (const entry of parts[0]) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" ||
          (prior !== null && entry[0] <= prior) || Object.hasOwn(output, entry[0])) fail("codec-map");
      prior = entry[0];
      output[entry[0]] = decodePrivateFirestoreValue(entry[1], factories);
    }
    return output;
  }
  fail("codec-shape");
}

export function privateArtifactPayloadDigest(payload) {
  return sha256(JSON.stringify(encodePrivateFirestoreValue(payload)));
}

function artifactText(kind, payload) {
  if (typeof kind !== "string" || !/^[a-z][a-z0-9-]{2,63}$/u.test(kind)) fail("artifact-kind");
  const encoded = encodePrivateFirestoreValue(payload);
  const envelope = {
    schemaVersion: PRIVATE_ARTIFACT_VERSION, kind, payload: encoded,
    payloadSha256: sha256(JSON.stringify(encoded)),
  };
  const text = `${JSON.stringify(envelope)}\n`;
  if (Buffer.byteLength(text) > PRIVATE_ARTIFACT_MAX_BYTES) fail("artifact-size");
  return { text, artifactSha256: sha256(text) };
}

async function driveType(drive) {
  const { stdout } = await promisify(execFile)("pwsh", ["-NoProfile", "-NonInteractive", "-Command",
    `[System.IO.DriveInfo]::new('${drive}:\\').DriveType.ToString()`],
  { windowsHide: true, timeout: 3000, maxBuffer: 1024, encoding: "utf8" });
  return stdout.trim();
}

function windowsAbsolute(path) {
  return typeof path === "string" && /^[A-Za-z]:[\\/]/u.test(path) && win32.isAbsolute(path) &&
    !/[\x00-\x1f:]/u.test(path.slice(2)) &&
    path.slice(3).split(/[\\/]/u).every((part) => part && !/[. ]$/u.test(part));
}

export async function validatePrivateArtifactPath(path, {
  repositoryRoot, allowExisting = false, lstatImpl = lstat, realpathImpl = realpath,
  driveTypeImpl = driveType,
} = {}) {
  try {
    if (!windowsAbsolute(path) || !windowsAbsolute(repositoryRoot) || await driveTypeImpl(path[0]) !== "Fixed") {
      fail("artifact-path");
    }
    const absolute = resolve(path);
    const repository = resolve(repositoryRoot);
    const lower = absolute.toLowerCase(), repoLower = repository.toLowerCase();
    if (lower === repoLower || lower.startsWith(`${repoLower}\\`)) fail("artifact-path");
    const parent = dirname(absolute);
    const ancestors = [];
    let cursor = parent;
    while (true) {
      ancestors.unshift(cursor);
      if (cursor === parse(cursor).root) break;
      cursor = dirname(cursor);
    }
    for (const ancestor of ancestors) {
      const stat = await lstatImpl(ancestor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail("artifact-path");
    }
    if ((await realpathImpl(parent)).toLowerCase() !== parent.toLowerCase()) fail("artifact-path");
    let existing = null;
    try { existing = await lstatImpl(absolute); } catch (error) { if (error?.code !== "ENOENT") throw error; }
    if ((!allowExisting && existing) || (existing && (!existing.isFile() || existing.isSymbolicLink()))) fail("artifact-exists");
    return absolute;
  } catch (error) {
    if (error instanceof PrivateArtifactError) throw error;
    fail("artifact-path");
  }
}

async function applyRestrictiveAccess(path) {
  if (process.platform !== "win32") return chmod(path, 0o600);
  const user = process.env.USERNAME;
  if (!user || /[\x00-\x1f]/u.test(user)) fail("artifact-acl");
  await promisify(execFile)("icacls", [path, "/inheritance:r", "/grant:r", `${user}:(F)`],
    { windowsHide: true, timeout: 5000, maxBuffer: 16 * 1024, encoding: "utf8" });
}

async function writeTemporary(path, text, { openImpl = open, secureAccessImpl = applyRestrictiveAccess } = {}) {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let handle;
  try {
    handle = await openImpl(temporary, "wx", 0o600);
    await handle.writeFile(text, { encoding: "utf8" });
    await handle.sync();
    await handle.close(); handle = null;
    await secureAccessImpl(temporary);
    return temporary;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    if (error instanceof PrivateArtifactError) throw error;
    fail("artifact-write");
  }
}

export async function writeNewPrivateArtifact(path, kind, payload, options = {}) {
  const absolute = await validatePrivateArtifactPath(path, { ...options, allowExisting: false });
  const { text, artifactSha256 } = artifactText(kind, payload);
  const temporary = await writeTemporary(absolute, text, options);
  try {
    try {
      await (options.linkImpl || (async (source, target) => {
        const { link } = await import("node:fs/promises"); return link(source, target);
      }))(temporary, absolute);
    } catch (error) {
      if (!["EPERM", "ENOSYS", "EOPNOTSUPP"].includes(error?.code)) throw error;
      await (options.copyFileImpl || copyFile)(temporary, absolute, fsConstants.COPYFILE_EXCL);
    }
    await unlink(temporary).catch(() => {});
    return { artifactSha256 };
  } catch {
    await unlink(temporary).catch(() => {});
    fail("artifact-write");
  }
}

async function boundedRead(path, { openImpl = open } = {}) {
  let handle;
  try {
    handle = await openImpl(path, "r");
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.size > PRIVATE_ARTIFACT_MAX_BYTES) fail("artifact-size");
    const buffer = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== stat.size) fail("artifact-size");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
  } catch (error) {
    if (error instanceof PrivateArtifactError) throw error;
    fail("artifact-read");
  } finally { if (handle) await handle.close().catch(() => {}); }
}

export async function readPrivateArtifact(path, expectedKind, options = {}) {
  const absolute = await validatePrivateArtifactPath(path, { ...options, allowExisting: true });
  const text = await boundedRead(absolute, options);
  let envelope;
  try { envelope = JSON.parse(text); } catch { fail("artifact-format"); }
  if (!exactKeys(envelope, ["schemaVersion", "kind", "payload", "payloadSha256"]) ||
      envelope.schemaVersion !== PRIVATE_ARTIFACT_VERSION || envelope.kind !== expectedKind ||
      !/^[0-9a-f]{64}$/u.test(envelope.payloadSha256) ||
      sha256(JSON.stringify(envelope.payload)) !== envelope.payloadSha256) fail("artifact-tamper");
  return {
    payload: decodePrivateFirestoreValue(envelope.payload, options.factories),
    artifactSha256: sha256(text), payloadSha256: envelope.payloadSha256,
  };
}

export async function privateArtifactExists(path, options = {}) {
  try {
    await validatePrivateArtifactPath(path, { ...options, allowExisting: true });
    const stat = await (options.lstatImpl || lstat)(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    if (error instanceof PrivateArtifactError && error.code === "artifact-path") {
      try { await (options.lstatImpl || lstat)(path); } catch (inner) { if (inner?.code === "ENOENT") return false; }
    }
    throw error;
  }
}

export async function replacePrivateArtifact(path, kind, payload, expectedArtifactSha256, options = {}) {
  if (!/^[0-9a-f]{64}$/u.test(expectedArtifactSha256 || "")) fail("artifact-precondition");
  const absolute = await validatePrivateArtifactPath(path, { ...options, allowExisting: true });
  const current = await boundedRead(absolute, options);
  if (sha256(current) !== expectedArtifactSha256) fail("artifact-precondition");
  const { text, artifactSha256 } = artifactText(kind, payload);
  const temporary = await writeTemporary(absolute, text, options);
  try { await (options.renameImpl || rename)(temporary, absolute); }
  catch { await unlink(temporary).catch(() => {}); fail("artifact-write"); }
  return { artifactSha256 };
}

export async function acquirePrivateLifecycleLock(path, scope, options = {}) {
  if (!["prepare", "apply", "rollback"].includes(scope)) fail("lock-scope");
  const reader = options.readArtifact || readPrivateArtifact;
  const remove = options.unlinkImpl || unlink;
  const payload = { schemaVersion: 1, scope, nonce: randomBytes(32).toString("hex") };
  const absolute = await validatePrivateArtifactPath(path, { ...options, allowExisting: false });
  const created = artifactText("operation-result-projection-lifecycle-lock", payload);
  const openImpl = options.lockOpenImpl || open;
  const secureAccessImpl = options.secureAccessImpl || applyRestrictiveAccess;
  const lstatImpl = options.lstatImpl || lstat;
  let handle = null, identity = null, ownsPath = false;
  try {
    handle = await openImpl(absolute, "wx", 0o600); ownsPath = true; identity = await handle.stat();
    await handle.writeFile(created.text, { encoding: "utf8" }); await handle.sync();
    await secureAccessImpl(absolute);
    await handle.close(); handle = null;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (ownsPath && identity) {
      try {
        const current = await lstatImpl(absolute);
        const currentText = await boundedRead(absolute, options);
        if (!current.isSymbolicLink() && current.isFile() && current.dev === identity.dev && current.ino === identity.ino &&
            sha256(currentText) === created.artifactSha256) await remove(absolute);
      } catch { /* preserve an uncertain lock instead of deleting another owner's file */ }
    }
    if (error?.code === "EEXIST") throw error;
    if (error instanceof PrivateArtifactError) throw error;
    fail("lock-write");
  }
  let released = false;
  return {
    artifactSha256: created.artifactSha256,
    async release() {
      if (released) return;
      const current = await reader(path, "operation-result-projection-lifecycle-lock", options);
      if (current.artifactSha256 !== created.artifactSha256 || !exactKeys(current.payload, ["schemaVersion", "scope", "nonce"]) ||
          current.payload.schemaVersion !== 1 || current.payload.scope !== scope || current.payload.nonce !== payload.nonce) fail("lock-changed");
      await remove(path); released = true;
    },
  };
}

export function isPrivateArtifactError(error) { return error instanceof PrivateArtifactError; }
