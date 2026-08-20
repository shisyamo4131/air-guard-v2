import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createUserEmailReservationId } from "../functions/modules/auth/createTemporaryUser.js";
import { normalizeTemporaryUserEmail } from "../functions/modules/auth/temporaryUserCreationPolicy.js";

export const CODEX_RESERVATION_MIGRATION_TARGET = Object.freeze({
  name: "codex-local",
  projectId: "demo-air-guard-v2-codex",
  firestoreHost: "127.0.0.1:18080",
});

const EXIT_CODES = Object.freeze({
  CLEAN: 0,
  CHANGES: 2,
  DATA_BLOCKER: 3,
  APPLY_INCOMPLETE: 4,
  UNEXPECTED: 70,
  TARGET_REJECTED: 78,
  USAGE: 64,
});

const USER_PATH = /^Companies\/([^/]+)\/Users\/([^/]+)$/;
const EMPLOYEE_PATH = /^Companies\/([^/]+)\/Employees\/([^/]+)$/;
const EMAIL_RESERVATION_PATH = /^UserEmailReservations\/([^/]+)$/;
const EMPLOYEE_RESERVATION_PATH =
  /^Companies\/([^/]+)\/EmployeeUserReservations\/([^/]+)$/;

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function isSafeId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("/")
  );
}

function exactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
  );
}

function opaqueSubject(value) {
  return createHash("sha256")
    .update(`airguard-uwb04\0${value}`, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function makeFinding(code, subject, blocking = true) {
  return Object.freeze({ code, subject: opaqueSubject(subject), blocking });
}

function parseRecord(record, pattern) {
  if (!isPlainObject(record) || typeof record.path !== "string") return null;
  const match = pattern.exec(record.path);
  return match ? { match, data: record.data } : null;
}

/**
 * Userと予約のsnapshotを監査し、予約だけを変更する決定的planを返します。
 * source recordのdataは変更しません。
 */
export function planUserReservationMigration({
  users = [],
  employees = [],
  emailReservations = [],
  employeeReservations = [],
} = {}) {
  const findings = [];
  const desiredByUser = new Map();
  const usersByEmail = new Map();
  const usersByEmployee = new Map();
  const userPaths = new Set();
  const employeePaths = new Set();

  for (const record of employees) {
    const parsed = parseRecord(record, EMPLOYEE_PATH);
    if (!parsed || !isSafeId(parsed.match[1]) || !isSafeId(parsed.match[2])) {
      findings.push(makeFinding("employee-path-invalid", record?.path ?? "invalid"));
      continue;
    }
    employeePaths.add(record.path);
  }

  for (const record of users) {
    const parsed = parseRecord(record, USER_PATH);
    if (!parsed || !isSafeId(parsed.match[1]) || !isSafeId(parsed.match[2])) {
      findings.push(makeFinding("user-path-invalid", record?.path ?? "invalid"));
      continue;
    }

    const [, companyId, userId] = parsed.match;
    const data = parsed.data;
    userPaths.add(record.path);
    if (!isPlainObject(data)) {
      findings.push(makeFinding("user-body-invalid", record.path));
      continue;
    }
    if (data.companyId !== companyId) {
      findings.push(makeFinding("user-company-mismatch", record.path));
      continue;
    }
    if (data.docId !== undefined && data.docId !== userId) {
      findings.push(makeFinding("user-document-id-mismatch", record.path));
      continue;
    }
    if (
      typeof data.isTemporary !== "boolean" ||
      typeof data.isAdmin !== "boolean" ||
      typeof data.disabled !== "boolean"
    ) {
      findings.push(makeFinding("user-state-invalid", record.path));
      continue;
    }
    if (
      (data.isTemporary && (data.isAdmin || data.disabled)) ||
      (data.isAdmin && data.disabled)
    ) {
      findings.push(makeFinding("user-state-invalid", record.path));
      continue;
    }

    let email;
    try {
      email = normalizeTemporaryUserEmail(data.email);
    } catch {
      findings.push(makeFinding("user-email-invalid", record.path));
      continue;
    }
    if (email !== data.email) {
      findings.push(makeFinding("user-email-not-canonical", record.path));
      continue;
    }

    let employeeId = null;
    if (data.employeeId !== undefined && data.employeeId !== null) {
      if (!isSafeId(data.employeeId)) {
        findings.push(makeFinding("user-employee-id-invalid", record.path));
        continue;
      }
      employeeId = data.employeeId;
      const employeePath = `Companies/${companyId}/Employees/${employeeId}`;
      if (!employeePaths.has(employeePath)) {
        findings.push(makeFinding("employee-dangling", record.path));
        continue;
      }
    }

    const desired = Object.freeze({
      subject: opaqueSubject(record.path),
      sourcePath: record.path,
      companyId,
      userId,
      email,
      employeeId,
      emailPath: `UserEmailReservations/${createUserEmailReservationId(email)}`,
      employeePath: employeeId
        ? `Companies/${companyId}/EmployeeUserReservations/${employeeId}`
        : null,
      expectedState: Object.freeze({
        docId: data.docId,
        isTemporary: data.isTemporary,
        isAdmin: data.isAdmin,
        disabled: data.disabled,
      }),
    });
    desiredByUser.set(record.path, desired);

    const emailUsers = usersByEmail.get(email) ?? [];
    emailUsers.push(desired);
    usersByEmail.set(email, emailUsers);
    if (employeeId) {
      const key = `${companyId}\0${employeeId}`;
      const employeeUsers = usersByEmployee.get(key) ?? [];
      employeeUsers.push(desired);
      usersByEmployee.set(key, employeeUsers);
    }
  }

  for (const group of usersByEmail.values()) {
    if (group.length > 1) {
      for (const desired of group) {
        findings.push(makeFinding("canonical-email-duplicate", desired.sourcePath));
      }
    }
  }
  for (const group of usersByEmployee.values()) {
    if (group.length > 1) {
      for (const desired of group) {
        findings.push(makeFinding("company-employee-duplicate", desired.sourcePath));
      }
    }
  }

  const emailByPath = new Map();
  for (const record of emailReservations) {
    const parsed = parseRecord(record, EMAIL_RESERVATION_PATH);
    if (!parsed) {
      findings.push(makeFinding("email-reservation-path-invalid", record?.path ?? "invalid"));
      continue;
    }
    emailByPath.set(record.path, record);
  }
  const employeeByPath = new Map();
  for (const record of employeeReservations) {
    const parsed = parseRecord(record, EMPLOYEE_RESERVATION_PATH);
    if (!parsed || !isSafeId(parsed.match[1]) || !isSafeId(parsed.match[2])) {
      findings.push(
        makeFinding("employee-reservation-path-invalid", record?.path ?? "invalid"),
      );
      continue;
    }
    employeeByPath.set(record.path, record);
  }

  const operations = [];
  for (const desired of desiredByUser.values()) {
    if ((usersByEmail.get(desired.email) ?? []).length !== 1) continue;
    if (
      desired.employeeId &&
      (usersByEmployee.get(`${desired.companyId}\0${desired.employeeId}`) ?? [])
        .length !== 1
    ) {
      continue;
    }

    const writes = [];
    const absentUserPaths = [];
    const emailRecord = emailByPath.get(desired.emailPath);
    const expectedEmail = {
      companyId: desired.companyId,
      userId: desired.userId,
    };
    if (!emailRecord) {
      writes.push({ kind: "create", path: desired.emailPath, data: expectedEmail });
    } else if (
      exactKeys(emailRecord.data, ["companyId", "userId"]) &&
      emailRecord.data.companyId === desired.companyId &&
      emailRecord.data.userId === desired.userId
    ) {
      emailByPath.delete(desired.emailPath);
    } else if (
      exactKeys(emailRecord.data, ["companyId", "userId"]) &&
      emailRecord.data.companyId === desired.companyId &&
      isSafeId(emailRecord.data.userId) &&
      !userPaths.has(
        `Companies/${emailRecord.data.companyId}/Users/${emailRecord.data.userId}`,
      )
    ) {
      writes.push({
        kind: "update",
        path: desired.emailPath,
        data: expectedEmail,
        expectedCurrent: emailRecord.data,
      });
      absentUserPaths.push(
        `Companies/${emailRecord.data.companyId}/Users/${emailRecord.data.userId}`,
      );
      emailByPath.delete(desired.emailPath);
    } else {
      findings.push(makeFinding("email-reservation-conflict", desired.sourcePath));
      emailByPath.delete(desired.emailPath);
      continue;
    }

    if (desired.employeePath) {
      const employeeRecord = employeeByPath.get(desired.employeePath);
      const expectedEmployee = { userId: desired.userId };
      if (!employeeRecord) {
        writes.push({
          kind: "create",
          path: desired.employeePath,
          data: expectedEmployee,
        });
      } else if (
        exactKeys(employeeRecord.data, ["userId"]) &&
        employeeRecord.data.userId === desired.userId
      ) {
        employeeByPath.delete(desired.employeePath);
      } else if (
        exactKeys(employeeRecord.data, ["userId"]) &&
        isSafeId(employeeRecord.data.userId) &&
        !userPaths.has(
          `Companies/${desired.companyId}/Users/${employeeRecord.data.userId}`,
        )
      ) {
        writes.push({
          kind: "update",
          path: desired.employeePath,
          data: expectedEmployee,
          expectedCurrent: employeeRecord.data,
        });
        absentUserPaths.push(
          `Companies/${desired.companyId}/Users/${employeeRecord.data.userId}`,
        );
        employeeByPath.delete(desired.employeePath);
      } else {
        findings.push(makeFinding("employee-reservation-conflict", desired.sourcePath));
        employeeByPath.delete(desired.employeePath);
        continue;
      }
    }

    operations.push(
      Object.freeze({
        subject: desired.subject,
        sourcePath: desired.sourcePath,
        expectedUser: Object.freeze({
          companyId: desired.companyId,
          userId: desired.userId,
          email: desired.email,
          employeeId: desired.employeeId,
          ...desired.expectedState,
        }),
        absentUserPaths: Object.freeze([...new Set(absentUserPaths)].sort()),
        writes: Object.freeze(writes.map((write) => Object.freeze(write))),
      }),
    );
  }

  for (const record of emailByPath.values()) {
    findings.push(makeFinding("email-reservation-orphan", record.path));
  }
  for (const record of employeeByPath.values()) {
    findings.push(makeFinding("employee-reservation-orphan", record.path));
  }

  const sortedFindings = findings.sort((a, b) =>
    `${a.code}:${a.subject}`.localeCompare(`${b.code}:${b.subject}`),
  );
  const sortedOperations = operations.sort((a, b) =>
    a.subject.localeCompare(b.subject),
  );
  const digestInput = {
    findings: sortedFindings,
    operations: sortedOperations.map(({ subject, absentUserPaths, writes }) => ({
      subject,
      absentUserPathHashes: absentUserPaths.map(opaqueSubject),
      writes: writes.map(({ kind, path, data, expectedCurrent }) => ({
        kind,
        pathHash: opaqueSubject(path),
        bodyHash: opaqueSubject(stableJson(data)),
        currentHash:
          expectedCurrent === undefined
            ? null
            : opaqueSubject(stableJson(expectedCurrent)),
      })),
    })),
  };
  const planDigest = createHash("sha256")
    .update(stableJson(digestInput), "utf8")
    .digest("hex");

  return Object.freeze({
    findings: Object.freeze(sortedFindings),
    operations: Object.freeze(sortedOperations),
    planDigest,
  });
}

export function summarizeUserReservationPlan(plan, { mode = "dry-run" } = {}) {
  const findingCounts = {};
  for (const finding of plan.findings) {
    findingCounts[finding.code] = (findingCounts[finding.code] ?? 0) + 1;
  }
  const writeCounts = { create: 0, update: 0, noop: 0, delete: 0 };
  for (const operation of plan.operations) {
    if (operation.writes.length === 0) writeCounts.noop += 1;
    for (const write of operation.writes) writeCounts[write.kind] += 1;
  }
  return {
    mode,
    status:
      plan.findings.length > 0
        ? "blocked"
        : writeCounts.create + writeCounts.update > 0
          ? "changes-required"
          : "clean",
    target: CODEX_RESERVATION_MIGRATION_TARGET.name,
    planDigest: plan.planDigest,
    findingCounts,
    writeCounts,
    subjects: plan.findings.map(({ code, subject }) => ({ code, subject })),
  };
}

export function assertCodexReservationMigrationTarget(env = process.env) {
  if (env.FIRESTORE_EMULATOR_HOST !== CODEX_RESERVATION_MIGRATION_TARGET.firestoreHost) {
    const error = new Error("Reservation migration requires the dedicated Firestore Emulator.");
    error.exitCode = EXIT_CODES.TARGET_REJECTED;
    throw error;
  }
  for (const name of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[name] && env[name] !== CODEX_RESERVATION_MIGRATION_TARGET.projectId) {
      const error = new Error("Reservation migration rejected a non-demo project.");
      error.exitCode = EXIT_CODES.TARGET_REJECTED;
      throw error;
    }
  }
  if (!env.GCLOUD_PROJECT && !env.GOOGLE_CLOUD_PROJECT) {
    const error = new Error("Reservation migration requires the dedicated demo project.");
    error.exitCode = EXIT_CODES.TARGET_REJECTED;
    throw error;
  }
  if (env.FIREBASE_CONFIG) {
    let config;
    try {
      config = JSON.parse(env.FIREBASE_CONFIG);
    } catch {
      const error = new Error("FIREBASE_CONFIG is invalid.");
      error.exitCode = EXIT_CODES.TARGET_REJECTED;
      throw error;
    }
    if (
      config.projectId &&
      config.projectId !== CODEX_RESERVATION_MIGRATION_TARGET.projectId
    ) {
      const error = new Error("Reservation migration rejected a non-demo Firebase config.");
      error.exitCode = EXIT_CODES.TARGET_REJECTED;
      throw error;
    }
  }
}

export function parseReservationMigrationArgs(args) {
  const parsed = { apply: false, planDigest: null, target: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") parsed.apply = true;
    else if (argument === "--target") parsed.target = args[++index];
    else if (argument === "--plan-digest") parsed.planDigest = args[++index];
    else {
      const error = new Error("Unknown reservation migration argument.");
      error.exitCode = EXIT_CODES.USAGE;
      throw error;
    }
  }
  if (parsed.target !== CODEX_RESERVATION_MIGRATION_TARGET.name) {
    const error = new Error("--target codex-local is required.");
    error.exitCode = EXIT_CODES.USAGE;
    throw error;
  }
  if (parsed.apply && !/^[a-f0-9]{64}$/.test(parsed.planDigest ?? "")) {
    const error = new Error("--apply requires a dry-run --plan-digest.");
    error.exitCode = EXIT_CODES.USAGE;
    throw error;
  }
  if (!parsed.apply && parsed.planDigest !== null) {
    const error = new Error("--plan-digest is only valid with --apply.");
    error.exitCode = EXIT_CODES.USAGE;
    throw error;
  }
  return parsed;
}

function snapshotsToRecords(snapshot) {
  return snapshot.docs.map((document) => ({ path: document.ref.path, data: document.data() }));
}

async function readMigrationState(firestore) {
  const [users, employees, emailReservations, employeeReservations] =
    await Promise.all([
      firestore.collectionGroup("Users").get(),
      firestore.collectionGroup("Employees").get(),
      firestore.collection("UserEmailReservations").get(),
      firestore.collectionGroup("EmployeeUserReservations").get(),
    ]);
  return {
    users: snapshotsToRecords(users),
    employees: snapshotsToRecords(employees),
    emailReservations: snapshotsToRecords(emailReservations),
    employeeReservations: snapshotsToRecords(employeeReservations),
  };
}

export async function applyUserReservationMigrationPlan(firestore, plan) {
  if (plan.findings.length > 0) {
    throw new Error("Reservation migration plan contains blocking findings.");
  }
  let applied = 0;
  for (const operation of plan.operations) {
    if (operation.writes.length === 0) continue;
    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.doc(operation.sourcePath);
      const userSnapshot = await transaction.get(userRef);
      const employeeRef = operation.expectedUser.employeeId
        ? firestore.doc(
            `Companies/${operation.expectedUser.companyId}/Employees/${operation.expectedUser.employeeId}`,
          )
        : null;
      const employeeSnapshot = employeeRef
        ? await transaction.get(employeeRef)
        : null;
      const emailUsersSnapshot = await transaction.get(
        firestore
          .collectionGroup("Users")
          .where("email", "==", operation.expectedUser.email)
          .limit(2),
      );
      const employeeUsersSnapshot = operation.expectedUser.employeeId
        ? await transaction.get(
            firestore
              .collection(
                `Companies/${operation.expectedUser.companyId}/Users`,
              )
              .where(
                "employeeId",
                "==",
                operation.expectedUser.employeeId,
              )
              .limit(2),
          )
        : null;
      const absentSnapshots = [];
      for (const path of operation.absentUserPaths) {
        absentSnapshots.push(await transaction.get(firestore.doc(path)));
      }
      const reads = [];
      for (const write of operation.writes) {
        reads.push({ write, snapshot: await transaction.get(firestore.doc(write.path)) });
      }

      if (!userSnapshot.exists) throw new Error("Migration source User changed.");
      const current = userSnapshot.data();
      if (
        current.companyId !== operation.expectedUser.companyId ||
        current.email !== operation.expectedUser.email ||
        (current.employeeId ?? null) !== operation.expectedUser.employeeId ||
        current.docId !== operation.expectedUser.docId ||
        current.isTemporary !== operation.expectedUser.isTemporary ||
        current.isAdmin !== operation.expectedUser.isAdmin ||
        current.disabled !== operation.expectedUser.disabled
      ) {
        throw new Error("Migration source User changed.");
      }
      if (employeeSnapshot && !employeeSnapshot.exists) {
        throw new Error("Migration Employee changed.");
      }
      const emailUserPaths = emailUsersSnapshot.docs.map(({ ref }) => ref.path);
      if (
        emailUserPaths.length !== 1 ||
        emailUserPaths[0] !== operation.sourcePath
      ) {
        throw new Error("Migration email ownership changed.");
      }
      if (employeeUsersSnapshot) {
        const employeeUserPaths = employeeUsersSnapshot.docs.map(({ ref }) => ref.path);
        if (
          employeeUserPaths.length !== 1 ||
          employeeUserPaths[0] !== operation.sourcePath
        ) {
          throw new Error("Migration Employee ownership changed.");
        }
      }
      if (absentSnapshots.some(({ exists }) => exists)) {
        throw new Error("Reservation pointer User changed.");
      }
      for (const { write, snapshot } of reads) {
        const reference = firestore.doc(write.path);
        if (write.kind === "create") {
          if (snapshot.exists) throw new Error("Reservation changed concurrently.");
          transaction.create(reference, write.data);
        } else {
          if (!snapshot.exists) throw new Error("Reservation changed concurrently.");
          if (stableJson(snapshot.data()) !== stableJson(write.expectedCurrent)) {
            throw new Error("Reservation changed concurrently.");
          }
          transaction.update(reference, write.data);
        }
      }
    });
    applied += 1;
  }
  return applied;
}

async function runCli() {
  const args = parseReservationMigrationArgs(process.argv.slice(2));
  assertCodexReservationMigrationTarget();
  const requireFromFunctions = createRequire(
    new URL("../functions/package.json", import.meta.url),
  );
  const { getApps, initializeApp, deleteApp } = requireFromFunctions("firebase-admin/app");
  const { getFirestore } = requireFromFunctions("firebase-admin/firestore");
  const app =
    getApps().find((candidate) => candidate.name === "uwb04-reservation-migration") ??
    initializeApp(
      { projectId: CODEX_RESERVATION_MIGRATION_TARGET.projectId },
      "uwb04-reservation-migration",
    );
  try {
    const firestore = getFirestore(app);
    const plan = planUserReservationMigration(await readMigrationState(firestore));
    const summary = summarizeUserReservationPlan(plan, {
      mode: args.apply ? "apply" : "dry-run",
    });
    if (plan.findings.length > 0) {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      return EXIT_CODES.DATA_BLOCKER;
    }
    if (!args.apply) {
      process.stdout.write(`${JSON.stringify(summary)}\n`);
      return summary.status === "clean" ? EXIT_CODES.CLEAN : EXIT_CODES.CHANGES;
    }
    if (args.planDigest !== plan.planDigest) {
      process.stdout.write(
        `${JSON.stringify({ ...summary, status: "plan-changed" })}\n`,
      );
      return EXIT_CODES.APPLY_INCOMPLETE;
    }
    const applied = await applyUserReservationMigrationPlan(firestore, plan);
    process.stdout.write(
      `${JSON.stringify({ ...summary, status: "applied", applied })}\n`,
    );
    return EXIT_CODES.CLEAN;
  } finally {
    await deleteApp(app);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(
        `${JSON.stringify({ status: "error", code: error?.exitCode ?? EXIT_CODES.UNEXPECTED })}\n`,
      );
      process.exitCode = error?.exitCode ?? EXIT_CODES.UNEXPECTED;
    });
}
