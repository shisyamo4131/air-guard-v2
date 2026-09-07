import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CUSTOMER_DOCUMENT_FIELDS, CUSTOMER_DOCUMENT_REASONS, inspectCustomerDocumentFields,
} from "../../utils/customer/customerDocumentContract.js";
import {
  CUSTOMER_CHECK_LIMITS, CUSTOMER_CHECK_REASONS, executeCustomerCompatibility,
  inspectCustomerQueryRows, readCustomerCredentialFile,
} from "../../scripts/check-customer-dev-compatibility.mjs";

const TIME = "2026-09-02T00:00:00.123456Z";
const ROOT = "projects/air-guard-v2-dev/databases/(default)/documents";
const FILE = "C:\\local\\customer-checker.json";
const ARGS = ["--read-only", "--project", "air-guard-v2-dev", "--database", "(default)"];
const ENV = { AIRGUARD_DEV_CREDENTIAL_PATH: FILE };
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const credential = {
  type: "service_account", project_id: "air-guard-v2-dev",
  client_email: "customer-checker@air-guard-v2-dev.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
};
const S = (value) => ({ stringValue: value });
const I = (value) => ({ integerValue: String(value) });
const N = () => ({ nullValue: null });
const M = (fields) => ({ mapValue: { fields } });

function fields(overrides = {}) {
  return {
    docId: S("customer-a"), uid: S("synthetic-actor"),
    createdAt: { timestampValue: TIME }, updatedAt: { timestampValue: TIME },
    code: N(), name: S("架空警備"), branchName: N(), abbreviation: S("架空"),
    nameKana: S("カクウ"), zipcode: S("1000001"), prefCode: S("13"),
    city: S("千代田区"), address: S("千代田1"), building: N(), location: N(),
    geopoint: N(), tel: N(), fax: N(), contractStatus: S("ACTIVE"),
    cutoffDate: I(0), paymentMonth: I(1), paymentDate: I(0), remarks: N(),
    fullAddress: S("東京都千代田区千代田1"), prefecture: S("東京都"), tokenMap: M({}),
    ...overrides,
  };
}
function row(company = "company-a", id = "customer-a", overrides = {}) {
  return { readTime: TIME, document: {
    name: `${ROOT}/Companies/${company}/Customers/${id}`, fields: fields({ docId: S(id), ...overrides }),
    createTime: TIME, updateTime: TIME,
  } };
}
function response(url, data, { status = 200, text, redirected = false, onCancel, chunkSize = Infinity } = {}) {
  const bytes = Buffer.from(text ?? JSON.stringify(data));
  let position = 0;
  return {
    url, status, redirected,
    body: new ReadableStream({
      pull(controller) {
        if (position === bytes.length) controller.close();
        else {
          const end = Math.min(position + chunkSize, bytes.length);
          controller.enqueue(bytes.subarray(position, end));
          position = end;
        }
      },
      cancel() { onCancel?.(); },
    }, { highWaterMark: 0 }),
  };
}
function harness({ rows = [row()], token = { access_token: "synthetic-token", token_type: "Bearer", expires_in: 3600 },
  fetchOverride, source = JSON.stringify(credential), env = ENV, args = ARGS, readOverride } = {}) {
  const calls = [];
  let reads = 0;
  return {
    calls, get reads() { return reads; },
    async run() {
      return executeCustomerCompatibility({
        args, env,
        readCredentialFile: async () => { reads += 1; if (readOverride) return readOverride(); return source; },
        fetchImpl: async (url, options) => {
          calls.push({ url, options });
          return fetchOverride ? fetchOverride(url, options, calls.length) : response(url, calls.length === 1 ? token : rows);
        },
      });
    },
  };
}
function assertSafe(result) {
  assert.deepEqual(Object.keys(result.summary), [
    "status", "complete", "documents", "compatibleDocuments", "incompatibleDocuments", "reasons",
  ]);
  assert.deepEqual(Object.keys(result.summary.reasons), CUSTOMER_CHECK_REASONS);
  assert.ok(Object.values(result.summary.reasons).every((value) => Number.isSafeInteger(value) && value >= 0));
  const output = JSON.stringify(result);
  for (const secret of ["customer-a", "company-a", "synthetic-actor", "synthetic-token", "架空警備", FILE,
    "PRIVATE KEY", "gserviceaccount.com", "unexpected-private-field", "PRIVATE_ERROR"]) {
    assert.ok(!output.includes(secret));
  }
}

test("Customer raw shape accepts exact 26 fields, nulls, integer wire values, and empty protobuf map", () => {
  assert.equal(CUSTOMER_DOCUMENT_FIELDS.length, 26);
  assert.ok(Object.isFrozen(CUSTOMER_DOCUMENT_FIELDS));
  assert.deepEqual(inspectCustomerDocumentFields(fields(), "customer-a"), []);
  assert.deepEqual(inspectCustomerDocumentFields(fields({ tokenMap: { mapValue: {} }, code: S("") }), "customer-a"), []);
  assert.deepEqual(inspectCustomerDocumentFields(fields({ contractStatus: S("TERMINATED"), tokenMap: N() }), "customer-a"), []);
});

test("Customer raw shape reports missing and extra fields without exposing unknown names", () => {
  for (const field of CUSTOMER_DOCUMENT_FIELDS) {
    const candidate = fields();
    delete candidate[field];
    assert.ok(inspectCustomerDocumentFields(candidate, "customer-a").includes("field-set"));
  }
  const reasons = inspectCustomerDocumentFields(fields({ "unexpected-private-field": S("PRIVATE_ERROR") }), "customer-a");
  assert.ok(reasons.includes("field-set"));
  assert.ok(reasons.every((reason) => CUSTOMER_DOCUMENT_REASONS.includes(reason)));
});

test("Customer raw shape refuses wrong types, limits, date normalization, and correlations", () => {
  const cases = [
    [{ name: S("") }, "required-string"], [{ name: S("名".repeat(21)) }, "required-string"],
    [{ code: S("x".repeat(11)) }, "nullable-string"], [{ fax: { integerValue: "1" } }, "nullable-string"],
    [{ docId: S("other") }, "doc-id"], [{ zipcode: S("") }, "postal-code"], [{ prefCode: S("48") }, "pref-code"],
    [{ contractStatus: S("SUSPENDED") }, "status"], [{ cutoffDate: I(31) }, "payment-integer"],
    [{ paymentMonth: { doubleValue: 1 } }, "payment-integer"], [{ paymentDate: { integerValue: "01" } }, "payment-integer"],
    [{ paymentMonth: I(7) }, "payment-integer"], [{ createdAt: S(TIME) }, "timestamp"],
    [{ updatedAt: { timestampValue: "2026-02-30T00:00:00Z" } }, "timestamp"],
    [{ createdAt: { timestampValue: "0000-01-01T00:00:00Z" } }, "timestamp"],
    [{ fullAddress: S("別住所") }, "address"], [{ tokenMap: M({ secret: { booleanValue: false } }) }, "token-map"],
    [{ tokenMap: M(Object.fromEntries(Array.from({ length: 513 }, (_, i) => [String(i), { booleanValue: true }]))) }, "token-map"],
    [{ name: { stringValue: "架空", integerValue: "1" } }, "wire-shape"],
    [{ name: S("😀") }, "unicode-unverified"], [{ name: S("\uD800") }, "unicode-unverified"],
  ];
  for (const [patch, expected] of cases) {
    assert.ok(inspectCustomerDocumentFields(fields(patch), "customer-a").includes(expected), expected);
  }
  assert.deepEqual(inspectCustomerDocumentFields(fields({ name: S("名".repeat(20)), code: S("x".repeat(10)) }), "customer-a"), []);
});

test("Customer location checks exact keys, finite range, matching GeoPoint and unknown omitted zeros", () => {
  const location = M({ formattedAddress: S("架空住所"), lat: I(0), lng: { doubleValue: 139.5 } });
  const geopoint = { geoPointValue: { latitude: 0, longitude: 139.5 } };
  assert.deepEqual(inspectCustomerDocumentFields(fields({ location, geopoint }), "customer-a"), []);
  const cases = [
    [{ location, geopoint: N() }, "wire-unverified"],
    [{ location, geopoint: { geoPointValue: { longitude: 139.5 } } }, "wire-unverified"],
    [{ location, geopoint: { geoPointValue: { latitude: 1, longitude: 139.5 } } }, "geopoint"],
    [{ location: M({ ...location.mapValue.fields, lat: { doubleValue: Infinity } }), geopoint }, "location"],
    [{ location: M({ ...location.mapValue.fields, lat: I(91) }), geopoint }, "location"],
    [{ location: M({ ...location.mapValue.fields, extra: S("x") }), geopoint }, "location"],
    [{ location: M({ ...location.mapValue.fields, formattedAddress: S("😀") }), geopoint }, "unicode-unverified"],
    [{ location: N(), geopoint }, "geopoint"],
  ];
  for (const [patch, expected] of cases) assert.ok(inspectCustomerDocumentFields(fields(patch), "customer-a").includes(expected));
});

test("Read-only query includes every status and tenant with fixed endpoint and bounded collectionGroup", async () => {
  const h = harness({ rows: [row(), row("company-b", "customer-b", { contractStatus: S("TERMINATED") })] });
  const result = await h.run();
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.documents, 2);
  assert.equal(result.summary.compatibleDocuments, 2);
  assert.equal(result.summary.complete, true);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].url, `https://firestore.googleapis.com/v1/${ROOT}:runQuery`);
  assert.deepEqual(JSON.parse(h.calls[1].options.body), {
    structuredQuery: { from: [{ collectionId: "Customers", allDescendants: true }], limit: 1001 },
  });
  for (const call of h.calls) {
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.redirect, "error");
  }
  assert.equal(h.calls[0].options.signal, h.calls[1].options.signal);
  assert.ok(h.calls[0].options.signal.aborted); // cleanup on success too
  assertSafe(result);
});

test("JWT is independently verified RS256 with fixed audience, datastore-only scope and short integer times", async () => {
  const h = harness();
  await h.run();
  const parameters = new URLSearchParams(h.calls[0].options.body);
  assert.deepEqual([...parameters.keys()], ["grant_type", "assertion"]);
  assert.equal(parameters.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [header, payload, signature] = parameters.get("assertion").split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  assert.deepEqual(Object.keys(claims), ["iss", "scope", "aud", "iat", "exp"]);
  assert.equal(claims.iss, credential.client_email);
  assert.equal(claims.aud, h.calls[0].url);
  assert.equal(claims.scope, "https://www.googleapis.com/auth/datastore");
  assert.ok(Number.isInteger(claims.iat));
  assert.ok(Math.abs(claims.iat - Date.now() / 1000) < 10);
  assert.equal(claims.exp - claims.iat, 300);
  assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")), true);
});

test("Zero documents needs a real readTime; done is optional but only true at the end", async () => {
  for (const rows of [[{ readTime: TIME }], [{ readTime: TIME, done: true }], [row(), { readTime: TIME, done: true }]]) {
    assert.equal((await harness({ rows }).run()).exitCode, 0);
  }
  for (const rows of [[], [{}], [{ done: true }], [{ readTime: TIME, done: false }],
    [{ readTime: TIME, done: true }, row()], [{ readTime: TIME, skippedResults: 1 }],
    [{ readTime: TIME, transaction: "PRIVATE_ERROR" }], [{ error: { message: "PRIVATE_ERROR" } }],
    [row(), { readTime: "2026-01-01T00:00:00Z" }]]) {
    const result = await harness({ rows }).run();
    assert.equal(result.exitCode, 1);
    assert.equal(result.summary.complete, false);
    assertSafe(result);
  }
});

test("Unexpected resource/path, duplicate document, missing metadata and document upper bound fail closed", async () => {
  for (const path of [
    "Customers/customer-a", "Companies/company-a/Customers_archive/customer-a",
    "Companies/company-a/Elsewhere/nested/Customers/customer-a", "Companies//Customers/customer-a",
  ]) {
    const document = row(); document.document.name = `${ROOT}/${path}`;
    assert.equal((await harness({ rows: [document] }).run()).summary.reasons["unexpected-path"], 1);
  }
  const foreign = row(); foreign.document.name = foreign.document.name.replace("air-guard-v2-dev", "air-guard-v2");
  assert.equal((await harness({ rows: [foreign] }).run()).exitCode, 1);
  assert.equal((await harness({ rows: [row(), row()] }).run()).summary.reasons["duplicate-document"], 1);
  const noTime = row(); delete noTime.document.updateTime;
  assert.equal((await harness({ rows: [noTime] }).run()).exitCode, 1);
  const limited = await harness({ args: [...ARGS, "--max-documents", "1"], rows: [row(), row("company-b", "customer-b")] }).run();
  assert.equal(limited.summary.reasons["document-limit"], 1);
  assert.equal(limited.summary.complete, false);
  assert.equal(inspectCustomerQueryRows([row()], 1).documents, 1);
});

test("Complete incompatible results contain counts and fixed reasons only", async () => {
  const result = await harness({ rows: [row(), row("company-b", "customer-b", {
    name: S(""), "unexpected-private-field": S("PRIVATE_ERROR"),
  })] }).run();
  assert.equal(result.exitCode, 2);
  assert.equal(result.summary.complete, true);
  assert.equal(result.summary.compatibleDocuments, 1);
  assert.equal(result.summary.incompatibleDocuments, 1);
  assert.equal(result.summary.reasons["field-set"], 1);
  assertSafe(result);
});

test("Bad argv and environment fail before reading credentials or making any request", async () => {
  for (const args of [[], ARGS.slice(1), [...ARGS, "--apply"], [...ARGS, "--read-only"],
    [...ARGS, "--max-documents", "1001"], [...ARGS, "--max-documents", "1.0"],
    [...ARGS, "--timeout-ms", "0"], [...ARGS, "--timeout-ms", "30001"],
    ["--read-only", "--project", "air-guard-v2", "--database", "(default)"],
    ["--read-only", "--project", "air-guard-v2-dev", "--database", "other"]]) {
    const h = harness({ args });
    assert.equal((await h.run()).summary.reasons.arguments, 1);
    assert.equal(h.reads, 0); assert.equal(h.calls.length, 0);
  }
  for (const patch of [
    { FIRESTORE_EMULATOR_HOST: "localhost:8080" }, { GCLOUD_PROJECT: "air-guard-v2" },
    { GOOGLE_APPLICATION_CREDENTIALS: "OTHER_PRIVATE_PATH" }, { FIREBASE_CONFIG: "{}" },
    { NODE_TLS_REJECT_UNAUTHORIZED: "0" }, { HTTPS_PROXY: "https://example.invalid" },
    { FIRESTORE_HOST: "example.invalid" }, { GOOGLE_CLOUD_UNIVERSE_DOMAIN: "example.invalid" },
    { NODE_OPTIONS: "--require private-hook" },
  ]) {
    const h = harness({ env: { ...ENV, ...patch } });
    assert.equal((await h.run()).summary.reasons.environment, 1);
    assert.equal(h.reads, 0); assert.equal(h.calls.length, 0);
  }
  const missing = harness({ env: {} });
  assert.equal((await missing.run()).summary.reasons["credential-file"], 1);
  assert.equal(missing.reads, 0);
});

test("Unreadable, mismatched, aliased, corrupt, and non-RSA credentials make no HTTP call", async () => {
  const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" });
  for (const source of ["not-json", "null", JSON.stringify({ ...credential, type: "authorized_user" }),
    JSON.stringify({ ...credential, project_id: "air-guard-v2" }),
    JSON.stringify({ ...credential, client_email: "other@air-guard-v2.iam.gserviceaccount.com" }),
    JSON.stringify({ ...credential, projectId: "air-guard-v2" }),
    JSON.stringify({ ...credential, privateKey: "PRIVATE_ERROR" }),
    JSON.stringify({ ...credential, private_key: "-----BEGIN PRIVATE KEY-----\ninvalid" }),
    JSON.stringify({ ...credential, private_key: ec })]) {
    const h = harness({ source });
    const result = await h.run();
    assert.equal(result.exitCode, 1); assert.equal(h.calls.length, 0); assertSafe(result);
  }
  const unreadable = harness({ readOverride() { throw new Error("PRIVATE_ERROR"); } });
  assert.equal((await unreadable.run()).summary.reasons["credential-file"], 1);
  assert.equal(unreadable.calls.length, 0);
});

test("Invalid OAuth payloads and failures never start the Firestore request", async () => {
  for (const token of [null, {}, { error: "PRIVATE_ERROR" },
    { access_token: "", token_type: "Bearer", expires_in: 1 },
    { access_token: "unsafe\nvalue", token_type: "Bearer", expires_in: 1 },
    { access_token: "token", token_type: "other", expires_in: 1 },
    { access_token: "token", token_type: "Bearer", expires_in: 0 },
    { access_token: "token", token_type: "Bearer", expires_in: -1 },
    { access_token: "token", token_type: "Bearer", expires_in: "3600" },
    { access_token: "token", token_type: "Bearer", expires_in: null },
    { access_token: "token", token_type: "Bearer", expires_in: 1, error: "PRIVATE_ERROR" }]) {
    const h = harness({ token });
    const result = await h.run();
    assert.equal(result.exitCode, 1); assert.equal(h.calls.length, 1); assertSafe(result);
  }
});

test("Redirect, wrong final URL, HTTP error, truncated JSON, and transport error fail safely", async () => {
  for (const failure of [
    (url) => response(url, {}, { status: 403 }),
    (url) => response(url, {}, { redirected: true }),
    (url) => response(`${url}/elsewhere`, {}),
    (url) => response(url, null, { text: '[{"PRIVATE_ERROR":' }),
    () => { throw new Error("PRIVATE_ERROR"); },
  ]) {
    for (const stage of [1, 2]) {
      const h = harness({ fetchOverride: (url, options, index) => index === stage ? failure(url) :
        response(url, { access_token: "synthetic-token", token_type: "Bearer", expires_in: 3600 }) });
      const result = await h.run();
      assert.equal(result.exitCode, 1); assert.equal(h.calls.length, stage); assertSafe(result);
    }
  }
});

test("A complete JSON chunk followed by a reader failure never counts as HTTP EOF", async () => {
  for (const stage of [1, 2]) {
    const token = { access_token: "token", token_type: "Bearer", expires_in: 3600 };
    const h = harness({ fetchOverride: (url, options, index) => {
      if (index !== stage) return response(url, token);
      let sent = false;
      return { url, status: 200, body: new ReadableStream({
        pull(controller) {
          if (sent) controller.error(new Error("PRIVATE_ERROR"));
          else { sent = true; controller.enqueue(Buffer.from(JSON.stringify(stage === 1 ? token : [row()]))); }
        },
      }, { highWaterMark: 0 }) };
    } });
    const result = await h.run();
    assert.equal(result.exitCode, 1);
    assert.equal(result.summary.complete, false);
    assert.equal(h.calls.length, stage);
    assertSafe(result);
  }
});

test("OAuth and Firestore byte budgets count streamed chunks, irrespective of Content-Length", async () => {
  for (const stage of [1, 2]) {
    let cancelled = false;
    const h = harness({ fetchOverride: (url, options, index) => {
      if (index !== stage) return response(url, { access_token: "token", token_type: "Bearer", expires_in: 3600 });
      return response(url, null, {
        text: "x".repeat((stage === 1 ? CUSTOMER_CHECK_LIMITS.tokenBytes : CUSTOMER_CHECK_LIMITS.responseBytes) + 1),
        chunkSize: stage === 1 ? CUSTOMER_CHECK_LIMITS.tokenBytes / 2 : CUSTOMER_CHECK_LIMITS.responseBytes / 2,
        onCancel() { cancelled = true; },
      });
    } });
    const result = await h.run();
    assert.equal(result.summary.reasons["response-size"], 1);
    assert.equal(h.calls.length, stage);
    assert.equal(h.calls[0].options.signal.aborted, true);
    assert.equal(cancelled, true);
  }
});

test("One deadline aborts OAuth/Firestore fetch and body consumption with no later request", async () => {
  for (const stage of [1, 2]) {
    for (const waitingBody of [false, true]) {
      let aborted = false;
      const h = harness({ args: [...ARGS, "--timeout-ms", "30"], fetchOverride: (url, options, index) => {
        if (index !== stage) return response(url, { access_token: "token", token_type: "Bearer", expires_in: 3600 });
        if (!waitingBody) return new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => { aborted = true; reject(new Error("PRIVATE_ERROR")); }, { once: true });
        });
        return { url, status: 200, body: new ReadableStream({ start(controller) {
          options.signal.addEventListener("abort", () => { aborted = true; controller.error(new Error("PRIVATE_ERROR")); }, { once: true });
        } }) };
      } });
      const result = await h.run();
      assert.equal(result.summary.reasons.timeout, 1);
      assert.equal(aborted, true); assert.equal(h.calls.length, stage); assertSafe(result);
    }
  }
});

test("The request deadline timer is cleared after success and early HTTP failure", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const pending = new Set();
  globalThis.setTimeout = (...args) => {
    const handle = originalSetTimeout(...args); pending.add(handle); return handle;
  };
  globalThis.clearTimeout = (handle) => { pending.delete(handle); return originalClearTimeout(handle); };
  try {
    assert.equal((await harness().run()).exitCode, 0);
    assert.equal(pending.size, 0);
    assert.equal((await harness({ fetchOverride: (url) => response(url, {}, { status: 403 }) }).run()).exitCode, 1);
    assert.equal(pending.size, 0);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    for (const handle of pending) originalClearTimeout(handle);
  }
});

function fileReaderFake({ content = JSON.stringify(credential), filePatch = {}, openedPatch = {}, symlink = false,
  realPath, chunkSize = 7 } = {}) {
  const bytes = Buffer.from(content);
  let position = 0;
  let closed = false;
  const stat = { size: bytes.length, dev: 1, ino: 2, isFile: () => true,
    isDirectory: () => false, isSymbolicLink: () => symlink, ...filePatch };
  return {
    get closed() { return closed; },
    options: {
      readDriveTypeImpl: async () => "Fixed",
      lstatImpl: async (path) => path === resolve(FILE) ? stat : {
        isSymbolicLink: () => false, isDirectory: () => true,
      },
      realpathImpl: async (path) => realPath ?? path,
      openImpl: async () => ({
        stat: async () => ({ ...stat, ...openedPatch }),
        read: async (buffer, offset, length) => {
          const count = Math.min(length, chunkSize, bytes.length - position);
          bytes.copy(buffer, offset, position, position + count);
          position += count;
          return { bytesRead: count };
        },
        close: async () => { closed = true; },
      }),
    },
  };
}

test("Credential reader rejects relative, UNC, device, ADS and symlink paths before open", async () => {
  for (const path of ["relative.json", "\\\\server\\share\\key.json", "\\\\?\\C:\\key.json",
    "C:\\key.json:stream", "C:\\local\\..\\key.json", "C:\\key.json "]) {
    await assert.rejects(() => readCustomerCredentialFile(path, {
      lstatImpl: async () => { assert.fail("invalid path must be rejected before stat"); },
    }), { message: "credential-file" });
  }
  for (const config of [{ symlink: true }, { filePatch: { isFile: () => false } },
    { filePatch: { size: 0 } }, { filePatch: { size: CUSTOMER_CHECK_LIMITS.credentialBytes + 1 } },
    { realPath: "C:\\elsewhere\\key.json" }, { openedPatch: { ino: 99 } }]) {
    const fake = fileReaderFake(config);
    await assert.rejects(() => readCustomerCredentialFile(FILE, fake.options), { message: "credential-file" });
  }
  const fake = fileReaderFake();
  const source = await readCustomerCredentialFile(FILE, fake.options);
  assert.equal(JSON.parse(source).project_id, "air-guard-v2-dev");
  assert.equal(fake.closed, true);
});

test("Credential read closes file and rejects changed length or invalid UTF-8", async () => {
  for (const config of [{ filePatch: { size: 2 } }, { content: Buffer.from([0xff, 0xfe]) }]) {
    const fake = fileReaderFake(config);
    await assert.rejects(() => readCustomerCredentialFile(FILE, fake.options), { message: "credential-file" });
    assert.equal(fake.closed, true);
  }
});

test("Remote or unknown mapped drives and drive-query failure stop before any file access", async () => {
  for (const result of ["Network", "Unknown", "NoRootDirectory", "Removable", "timeout"]) {
    let fileCalls = 0;
    const h = harness({ readOverride: () => readCustomerCredentialFile(FILE, {
      readDriveTypeImpl: async () => {
        if (result === "timeout") throw new Error("PRIVATE_ERROR");
        return result;
      },
      lstatImpl: async () => { fileCalls += 1; throw new Error("unexpected stat"); },
      openImpl: async () => { fileCalls += 1; throw new Error("unexpected open"); },
    }) });
    assert.equal((await h.run()).summary.reasons["credential-file"], 1);
    assert.equal(fileCalls, 0); assert.equal(h.calls.length, 0);
  }
});

test("Ancestor junction is rejected before lstat reaches the credential file", async () => {
  let fileCalls = 0;
  await assert.rejects(() => readCustomerCredentialFile(FILE, {
    readDriveTypeImpl: async () => "Fixed",
    lstatImpl: async (path) => {
      if (path === resolve(FILE)) fileCalls += 1;
      return { isSymbolicLink: () => path === resolve("C:\\local"), isDirectory: () => true };
    },
    openImpl: async () => { fileCalls += 1; throw new Error("unexpected open"); },
  }), { message: "credential-file" });
  assert.equal(fileCalls, 0);
});

test("Importing the checker does not call fetch", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls += 1; throw new Error("network forbidden"); };
  try {
    await import(`../../scripts/check-customer-dev-compatibility.mjs?import-only=${Date.now()}`);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("The real CLI rejects missing arguments with exit 1, one safe JSON line and empty stderr", () => {
  const child = spawnSync(process.execPath, [fileURLToPath(new URL(
    "../../scripts/check-customer-dev-compatibility.mjs", import.meta.url,
  ))], { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024, encoding: "utf8" });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 1);
  assert.equal(child.signal, null);
  assert.equal(child.stderr, "");
  const lines = child.stdout.trim().split(/\r?\n/u);
  assert.equal(lines.length, 1);
  const summary = JSON.parse(lines[0]);
  assert.equal(summary.status, "blocked");
  assert.equal(summary.complete, false);
  assert.equal(summary.reasons.arguments, 1);
  assertSafe({ exitCode: child.status, summary });
});
