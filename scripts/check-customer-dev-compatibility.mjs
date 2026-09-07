import { createPrivateKey, sign } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, open, realpath } from "node:fs/promises";
import { dirname, parse, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  CUSTOMER_DOCUMENT_REASONS, inspectCustomerDocumentFields, isRecord, isWireTimestamp,
} from "../utils/customer/customerDocumentContract.js";

export const CUSTOMER_DEV_TARGET = Object.freeze({ project: "air-guard-v2-dev", database: "(default)" });
export const CUSTOMER_CHECK_LIMITS = Object.freeze({
  documents: 1000, timeoutMs: 30000, responseBytes: 16 * 1024 * 1024,
  tokenBytes: 64 * 1024, credentialBytes: 64 * 1024,
});
export const CUSTOMER_CHECK_REASONS = Object.freeze([
  ...CUSTOMER_DOCUMENT_REASONS, "arguments", "environment", "credential-file",
  "credential-format", "credential-key", "authentication", "read-failed", "timeout",
  "response-size", "response-format", "response-incomplete", "unexpected-path",
  "duplicate-document", "document-limit", "internal-error",
]);
const OAUTH_URL = "https://accounts.google.com/o/oauth2/token";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const RESOURCE_ROOT = `projects/${CUSTOMER_DEV_TARGET.project}/databases/${CUSTOMER_DEV_TARGET.database}/documents`;
const QUERY_URL = `https://firestore.googleapis.com/v1/${RESOURCE_ROOT}:runQuery`;

class CheckFailure extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}
function fail(reason) { throw new CheckFailure(reason); }
function hasOnlyKeys(value, allowed) {
  return isRecord(value) && Object.keys(value).every((key) => allowed.includes(key));
}

export function parseCustomerCompatibilityArgs(args) {
  const values = {};
  const allowed = ["--read-only", "--project", "--database", "--max-documents", "--timeout-ms"];
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!allowed.includes(key) || Object.hasOwn(values, key)) fail("arguments");
    if (key === "--read-only") values[key] = true;
    else {
      const value = args[++index];
      if (typeof value !== "string" || value.startsWith("--")) fail("arguments");
      values[key] = value;
    }
  }
  if (values["--read-only"] !== true || values["--project"] !== CUSTOMER_DEV_TARGET.project ||
      values["--database"] !== CUSTOMER_DEV_TARGET.database) fail("arguments");
  function bounded(key, maximum) {
    if (!Object.hasOwn(values, key)) return maximum;
    if (!/^[1-9][0-9]*$/u.test(values[key])) fail("arguments");
    const value = Number(values[key]);
    if (!Number.isSafeInteger(value) || value > maximum) fail("arguments");
    return value;
  }
  return {
    maxDocuments: bounded("--max-documents", CUSTOMER_CHECK_LIMITS.documents),
    timeoutMs: bounded("--timeout-ms", CUSTOMER_CHECK_LIMITS.timeoutMs),
  };
}

export function assertCustomerCompatibilityEnvironment(env) {
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || value === "") continue;
    const key = name.toUpperCase();
    if (key.includes("EMULATOR") ||
        (/^(FIRESTORE|FIREBASE|GOOGLE|GCLOUD|GCP)_/u.test(key) && /HOST|ENDPOINT|UNIVERSE/u.test(key)) ||
        ["FIREBASE_CONFIG", "GOOGLE_APPLICATION_CREDENTIALS", "NODE_OPTIONS", "NODE_USE_ENV_PROXY",
          "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"].includes(key)) fail("environment");
    if (key === "NODE_TLS_REJECT_UNAUTHORIZED" && value !== "1") fail("environment");
    if (["GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT", "FIREBASE_PROJECT_ID"].includes(key) &&
        value !== CUSTOMER_DEV_TARGET.project) fail("environment");
  }
  if (typeof env.AIRGUARD_DEV_CREDENTIAL_PATH !== "string" ||
      !env.AIRGUARD_DEV_CREDENTIAL_PATH) fail("credential-file");
}

async function readDriveType(drive) {
  if (!/^[A-Za-z]$/u.test(drive)) fail("credential-file");
  const { stdout } = await promisify(execFile)("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command",
    `[System.IO.DriveInfo]::new('${drive}:\\').DriveType.ToString()`,
  ], { windowsHide: true, timeout: 3000, maxBuffer: 1024, encoding: "utf8" });
  return stdout.trim();
}

export async function readCustomerCredentialFile(path, {
  lstatImpl = lstat, realpathImpl = realpath, openImpl = open, readDriveTypeImpl = readDriveType,
} = {}) {
  let handle;
  try {
    // Windows primary repository: drive-absolute local files only; no UNC,
    // device namespaces, alternate streams, or path aliases through dot segments.
    if (typeof path !== "string" || !/^[A-Za-z]:[\\/]/u.test(path) ||
        !win32.isAbsolute(path) || /[\x00-\x1f:]/u.test(path.slice(2)) ||
        path.slice(3).split(/[\\/]/u).some((part) => !part || /[. ]$/u.test(part))) fail("credential-file");
    // DriveType consults local drive metadata before any potentially remote file
    // access. Mapped shares, removable drives and unknown types are not accepted.
    if (await readDriveTypeImpl(path[0]) !== "Fixed") fail("credential-file");
    const absolute = resolve(path);
    let cursor = absolute;
    const ancestors = [];
    let fileStat;
    while (true) {
      ancestors.unshift(cursor);
      if (cursor === parse(cursor).root) break;
      cursor = dirname(cursor);
    }
    // Check from root toward the file so lstat on a child cannot traverse a
    // junction/symlink before that ancestor has been rejected.
    for (const ancestor of ancestors) {
      const stat = await lstatImpl(ancestor);
      if (stat.isSymbolicLink()) fail("credential-file");
      if (ancestor === absolute) fileStat = stat;
      else if (!stat.isDirectory()) fail("credential-file");
    }
    if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > CUSTOMER_CHECK_LIMITS.credentialBytes) fail("credential-file");
    if ((await realpathImpl(absolute)).toLowerCase() !== absolute.toLowerCase()) fail("credential-file");
    handle = await openImpl(absolute, "r");
    const openedStat = await handle.stat();
    if (!openedStat.isFile() || openedStat.dev !== fileStat.dev || openedStat.ino !== fileStat.ino ||
        openedStat.size !== fileStat.size) fail("credential-file");
    // Bounded read also detects growth after stat; never readFile an unbounded file.
    const buffer = Buffer.alloc(CUSTOMER_CHECK_LIMITS.credentialBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length !== fileStat.size || length > CUSTOMER_CHECK_LIMITS.credentialBytes) fail("credential-file");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
  } catch { fail("credential-file"); }
  finally { if (handle) await handle.close().catch(() => {}); }
}

export function validateCustomerCredential(source) {
  let credential;
  try { credential = JSON.parse(source); } catch { fail("credential-format"); }
  if (!isRecord(credential) || credential.type !== "service_account" ||
      credential.project_id !== CUSTOMER_DEV_TARGET.project ||
      ["projectId", "clientEmail", "privateKey"].some((key) => Object.hasOwn(credential, key)) ||
      typeof credential.client_email !== "string" ||
      !/^[a-z][a-z0-9-]*@air-guard-v2-dev\.iam\.gserviceaccount\.com$/u.test(credential.client_email) ||
      typeof credential.private_key !== "string" ||
      !credential.private_key.startsWith("-----BEGIN PRIVATE KEY-----\n")) fail("credential-format");
  let key;
  try {
    key = createPrivateKey(credential.private_key);
    if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails.modulusLength < 2048) fail("credential-key");
  } catch { fail("credential-key"); }
  return { email: credential.client_email, key };
}

function createAssertion(credential) {
  const issued = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: credential.email, scope: DATASTORE_SCOPE, aud: OAUTH_URL, iat: issued, exp: issued + 300,
  })}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), credential.key).toString("base64url")}`;
}

function emptySummary() {
  return {
    status: "blocked", complete: false, documents: 0, compatibleDocuments: 0,
    incompatibleDocuments: 0, reasons: Object.fromEntries(CUSTOMER_CHECK_REASONS.map((reason) => [reason, 0])),
  };
}

export function inspectCustomerQueryRows(rows, maxDocuments) {
  if (!Array.isArray(rows) || rows.length === 0) fail("response-incomplete");
  const result = emptySummary();
  const names = new Set();
  let priorReadTime = "";
  for (const [index, row] of rows.entries()) {
    if (!hasOnlyKeys(row, ["document", "readTime", "skippedResults", "done"]) ||
        Object.keys(row).length === 0 ||
        (Object.hasOwn(row, "skippedResults") && row.skippedResults !== 0) ||
        (Object.hasOwn(row, "done") && (row.done !== true || index !== rows.length - 1))) fail("response-format");
    if (!isWireTimestamp(row.readTime)) fail("response-incomplete");
    const comparable = row.readTime.slice(0, 19) + (row.readTime.slice(19, -1).slice(1) || "").padEnd(9, "0");
    if (priorReadTime && comparable < priorReadTime) fail("response-format");
    priorReadTime = comparable;
    if (!Object.hasOwn(row, "document")) continue;
    const document = row.document;
    if (!hasOnlyKeys(document, ["name", "fields", "createTime", "updateTime"]) ||
        typeof document.name !== "string") fail("response-format");
    if (!document.name.startsWith(`${RESOURCE_ROOT}/`)) fail("unexpected-path");
    const segments = document.name.slice(RESOURCE_ROOT.length + 1).split("/");
    if (segments.length !== 4 || segments[0] !== "Companies" || segments[2] !== "Customers" ||
        !segments[1] || !segments[3] || segments.some((part) => /[\x00-\x1f\x7f]/u.test(part))) fail("unexpected-path");
    if (names.has(document.name)) fail("duplicate-document");
    names.add(document.name);
    result.documents += 1;
    if (result.documents > maxDocuments) fail("document-limit");
    if (![document.createTime, document.updateTime].every(isWireTimestamp)) fail("response-format");
    const findings = inspectCustomerDocumentFields(document.fields, segments[3]);
    if (findings.length) {
      result.incompatibleDocuments += 1;
      for (const reason of findings) result.reasons[reason] += 1;
    } else result.compatibleDocuments += 1;
  }
  result.complete = true;
  result.status = result.incompatibleDocuments ? "incompatible" : "compatible";
  return result;
}

async function readJsonResponse(response, maximum, controller, checkDeadline) {
  let reader;
  let complete = false;
  try {
    if (!response.body || typeof response.body.getReader !== "function") fail("response-incomplete");
    reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
      checkDeadline();
      const chunk = await reader.read();
      checkDeadline();
      if (chunk.done) { complete = true; break; }
      if (!(chunk.value instanceof Uint8Array)) fail("response-format");
      bytes += chunk.value.byteLength;
      if (bytes > maximum) fail("response-size");
      chunks.push(chunk.value);
    }
    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes)));
    } catch { fail("response-format"); }
    checkDeadline();
    return parsed;
  } finally {
    if (reader) {
      if (!complete) {
        controller.abort();
        await reader.cancel().catch(() => {});
      }
      reader.releaseLock();
    }
  }
}

// All side effects are inside this explicit call. Test dependencies must be fake;
// importing this module neither reads credentials nor initializes an SDK/client.
export async function executeCustomerCompatibility({
  args = [], env = {}, fetchImpl = globalThis.fetch, readCredentialFile = readCustomerCredentialFile,
} = {}) {
  let controller;
  let timer;
  let timedOut = false;
  let stage = "internal-error";
  try {
    const options = parseCustomerCompatibilityArgs(args);
    assertCustomerCompatibilityEnvironment(env);
    stage = "credential-file";
    const credential = validateCustomerCredential(await readCredentialFile(env.AIRGUARD_DEV_CREDENTIAL_PATH));
    stage = "credential-key";
    const assertion = createAssertion(credential);
    controller = new AbortController();
    const deadline = Date.now() + options.timeoutMs;
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs);
    const checkDeadline = () => {
      if (timedOut || Date.now() >= deadline) { timedOut = true; controller.abort(); fail("timeout"); }
    };
    async function request(url, body, maximum, headers = {}) {
      checkDeadline();
      const response = await fetchImpl(url, {
        method: "POST", redirect: "error", signal: controller.signal, headers, body,
      });
      checkDeadline();
      if (response.status !== 200 || response.redirected === true || response.url !== url) {
        controller.abort();
        await response.body?.cancel().catch(() => {});
        fail(stage);
      }
      return readJsonResponse(response, maximum, controller, checkDeadline);
    }
    stage = "authentication";
    const token = await request(OAUTH_URL, new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion,
    }).toString(), CUSTOMER_CHECK_LIMITS.tokenBytes, { "Content-Type": "application/x-www-form-urlencoded" });
    if (!hasOnlyKeys(token, ["access_token", "token_type", "expires_in", "scope"]) ||
        typeof token.access_token !== "string" || !/^[A-Za-z0-9._~+/-]+=*$/u.test(token.access_token) ||
        token.token_type !== "Bearer" ||
        typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) fail("authentication");
    checkDeadline();
    stage = "read-failed";
    const rows = await request(QUERY_URL, JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "Customers", allDescendants: true }], limit: options.maxDocuments + 1,
    } }), CUSTOMER_CHECK_LIMITS.responseBytes, {
      "Content-Type": "application/json", Authorization: `Bearer ${token.access_token}`,
    });
    const summary = inspectCustomerQueryRows(rows, options.maxDocuments);
    checkDeadline();
    return { exitCode: summary.status === "compatible" ? 0 : 2, summary };
  } catch (error) {
    const reason = timedOut ? "timeout" : error instanceof CheckFailure ? error.reason : stage;
    const summary = emptySummary();
    summary.reasons[CUSTOMER_CHECK_REASONS.includes(reason) ? reason : "internal-error"] = 1;
    return { exitCode: 1, summary };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (controller) controller.abort();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await executeCustomerCompatibility({ args: process.argv.slice(2), env: process.env });
  process.stdout.write(`${JSON.stringify(result.summary)}\n`);
  process.exitCode = result.exitCode;
}
