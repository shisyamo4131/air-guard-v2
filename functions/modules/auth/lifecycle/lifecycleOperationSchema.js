/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/lifecycleOperationSchema.js
 * @description UWB-07 lifecycle operation、event、lock、Employee headの
 * server-only schemaとpathを定義します。
 *****************************************************************************/
import { createHash } from "node:crypto";

export const LIFECYCLE_OPERATION_TYPES = Object.freeze({
  EMPLOYEE_RETIREMENT: "employee-retirement",
  STANDALONE_REGISTERED_USER_DELETION:
    "standalone-registered-user-deletion",
  EMPLOYEE_REINSTATEMENT: "employee-reinstatement",
});

export const LIFECYCLE_OPERATION_STATES = Object.freeze({
  ACCESS_REVOKE_PENDING: "access-revoke-pending",
  ACCESS_REVOKED: "access-revoked",
  AUTH_DELETE_INTENT: "auth-delete-intent",
  DATA_FINALIZED: "data-finalized",
  COMPLETED: "completed",
  FAILED_RETRYABLE: "failed-retryable",
});

export const LIFECYCLE_AUTH_DISPOSITIONS = Object.freeze({
  NOT_APPLICABLE: "not-applicable",
  PRESENT: "present",
  DELETED: "deleted",
  ALREADY_ABSENT: "already-absent",
});

export const LIFECYCLE_CLEANUP_STATES = Object.freeze({
  NOT_APPLICABLE: "not-applicable",
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
});

export const LIFECYCLE_EVENT_PHASES = Object.freeze({
  EMPLOYEE_RETIREMENT: "employee-retirement",
  ACCESS_REVOKE: "access-revoke",
  AUTH_DISABLE: "auth-disable",
  AUTH_DELETE_INTENT: "auth-delete-intent",
  AUTH_DELETE: "auth-delete",
  DATA_FINALIZE: "data-finalize",
  FCM_CLEANUP: "fcm-cleanup",
  EMPLOYEE_REINSTATEMENT: "employee-reinstatement",
});

export const LIFECYCLE_EVENT_OUTCOMES = Object.freeze({
  SUCCEEDED: "succeeded",
  FAILED_RETRYABLE: "failed-retryable",
  ALREADY_COMPLETED: "already-completed",
});

export const LIFECYCLE_DOMAIN_ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: "UNAUTHENTICATED",
  AUTH_IDENTITY_INVALID: "AUTH_IDENTITY_INVALID",
  INVALID_INPUT: "INVALID_INPUT",
  ACTOR_NOT_ALLOWED: "ACTOR_NOT_ALLOWED",
  TARGET_NOT_FOUND: "TARGET_NOT_FOUND",
  SOURCE_OPERATION_NOT_FOUND: "SOURCE_OPERATION_NOT_FOUND",
  OPERATION_ID_CONFLICT: "OPERATION_ID_CONFLICT",
  SELF_OPERATION_DENIED: "SELF_OPERATION_DENIED",
  TARGET_STATE_INVALID: "TARGET_STATE_INVALID",
  ADMIN_TARGET_DENIED: "ADMIN_TARGET_DENIED",
  SUPER_USER_TARGET_DENIED: "SUPER_USER_TARGET_DENIED",
  RELATIONSHIP_INCONSISTENT: "RELATIONSHIP_INCONSISTENT",
  AUTH_IDENTITY_MISMATCH: "AUTH_IDENTITY_MISMATCH",
  TEMPORARY_USER_LINKED: "TEMPORARY_USER_LINKED",
  SOURCE_NOT_COMPLETED: "SOURCE_NOT_COMPLETED",
  ALREADY_REINSTATED: "ALREADY_REINSTATED",
  LATEST_OPERATION_MISMATCH: "LATEST_OPERATION_MISMATCH",
  TARGET_OPERATION_ACTIVE: "TARGET_OPERATION_ACTIVE",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  INTERNAL: "INTERNAL",
});

const OPERATION_FIELDS = Object.freeze([
  "schemaVersion",
  "operationId",
  "operationType",
  "state",
  "actorUid",
  "actorDisplayName",
  "employeeId",
  "targetUserUid",
  "targetDisplayName",
  "reversesOperationId",
  "terminationDate",
  "reasonOfTermination",
  "offboardingReason",
  "correctionReasonCode",
  "requestFingerprint",
  "authDisposition",
  "cleanupState",
  "attemptCount",
  "lastErrorPhase",
  "lastErrorCode",
  "createdAt",
  "updatedAt",
  "authDeletedAt",
  "dataFinalizedAt",
  "completedAt",
]);
const EVENT_FIELDS = Object.freeze([
  "phase",
  "attempt",
  "outcome",
  "errorCode",
  "at",
]);
const LOCK_FIELDS = Object.freeze([
  "operationId",
  "operationType",
  "createdAt",
]);
const HEAD_FIELDS = Object.freeze([
  "revision",
  "latestOperationId",
  "latestOperationType",
  "updatedAt",
]);
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

const OPERATION_TYPE_VALUES = new Set(Object.values(LIFECYCLE_OPERATION_TYPES));
const OPERATION_STATE_VALUES = new Set(Object.values(LIFECYCLE_OPERATION_STATES));
const AUTH_DISPOSITION_VALUES = new Set(
  Object.values(LIFECYCLE_AUTH_DISPOSITIONS),
);
const CLEANUP_STATE_VALUES = new Set(Object.values(LIFECYCLE_CLEANUP_STATES));
const EVENT_PHASE_VALUES = new Set(Object.values(LIFECYCLE_EVENT_PHASES));
const EVENT_OUTCOME_VALUES = new Set(Object.values(LIFECYCLE_EVENT_OUTCOMES));
const DOMAIN_ERROR_CODE_VALUES = new Set(
  Object.values(LIFECYCLE_DOMAIN_ERROR_CODES),
);
const FINGERPRINT_FIELDS = Object.freeze({
  [LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT]: [
    "employeeId",
    "terminationDate",
    "reasonOfTermination",
  ],
  [LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION]: [
    "targetUserId",
    "reason",
  ],
  [LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT]: [
    "employeeId",
    "reversesOperationId",
    "correctionReasonCode",
  ],
});

export const LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES = Object.freeze({
  INPUT_INVALID: "input-invalid",
  FIELD_SET_INVALID: "field-set-invalid",
  IDENTIFIER_INVALID: "identifier-invalid",
  ENUM_INVALID: "enum-invalid",
  TEXT_INVALID: "text-invalid",
  TIMESTAMP_INVALID: "timestamp-invalid",
  OPERATION_SHAPE_INVALID: "operation-shape-invalid",
  EVENT_SHAPE_INVALID: "event-shape-invalid",
  LOCK_SHAPE_INVALID: "lock-shape-invalid",
  HEAD_SHAPE_INVALID: "head-shape-invalid",
});

export class LifecycleOperationSchemaError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "LifecycleOperationSchemaError";
    this.code = code;
  }
}

function fail(code, message, options = {}) {
  throw new LifecycleOperationSchemaError(code, message, options);
}

function isPlainObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype ||
        Object.getPrototypeOf(value) === null),
  );
}

function assertExactFields(value, fields, label) {
  if (!isPlainObject(value)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.INPUT_INVALID,
      `[lifecycleOperationSchema] ${label} must be a plain object`,
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.FIELD_SET_INVALID,
      `[lifecycleOperationSchema] ${label} field set is invalid`,
    );
  }
}

function assertDocumentId(value, label) {
  if (
    typeof value !== "string" ||
    !value ||
    /\s/u.test(value) ||
    value.includes("/")
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.IDENTIFIER_INVALID,
      `[lifecycleOperationSchema] ${label} is invalid`,
    );
  }
}

function assertUuid(value, label) {
  if (typeof value !== "string" || !UUID_V4_PATTERN.test(value)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.IDENTIFIER_INVALID,
      `[lifecycleOperationSchema] ${label} must be a lower-case UUID v4`,
    );
  }
}

function assertNullableDocumentId(value, label) {
  if (value !== null) assertDocumentId(value, label);
}

function assertNullableUuid(value, label) {
  if (value !== null) assertUuid(value, label);
}

function assertTrimmedText(value, label, maxLength, nullable = false) {
  if (nullable && value === null) return;
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    value.length > maxLength
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.TEXT_INVALID,
      `[lifecycleOperationSchema] ${label} is invalid`,
    );
  }
}

function assertTimestamp(value, label, nullable = false) {
  if (nullable && value === null) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.TIMESTAMP_INVALID,
      `[lifecycleOperationSchema] ${label} is not a server timestamp value`,
    );
  }
}

function assertEnum(value, allowed, label, nullable = false) {
  if (nullable && value === null) return;
  if (!allowed.has(value)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.ENUM_INVALID,
      `[lifecycleOperationSchema] ${label} is invalid`,
    );
  }
}

function assertTypeSpecificOperation(record) {
  const nullFields = (fields) => {
    for (const field of fields) {
      if (record[field] !== null) {
        fail(
          LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
          `[lifecycleOperationSchema] ${field} must be null for ${record.operationType}`,
        );
      }
    }
  };

  switch (record.operationType) {
    case LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT:
      assertDocumentId(record.employeeId, "employeeId");
      if (!DATE_ONLY_PATTERN.test(record.terminationDate ?? "")) {
        fail(
          LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
          "[lifecycleOperationSchema] terminationDate is invalid",
        );
      }
      assertTrimmedText(
        record.reasonOfTermination,
        "reasonOfTermination",
        20,
      );
      nullFields([
        "reversesOperationId",
        "offboardingReason",
        "correctionReasonCode",
      ]);
      break;
    case LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION:
      assertDocumentId(record.targetUserUid, "targetUserUid");
      assertTrimmedText(record.targetDisplayName, "targetDisplayName", 6);
      assertTrimmedText(record.offboardingReason, "offboardingReason", 20);
      nullFields([
        "employeeId",
        "reversesOperationId",
        "terminationDate",
        "reasonOfTermination",
        "correctionReasonCode",
      ]);
      break;
    case LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT:
      assertDocumentId(record.employeeId, "employeeId");
      assertUuid(record.reversesOperationId, "reversesOperationId");
      if (record.correctionReasonCode !== "MISTAKEN_RETIREMENT") {
        fail(
          LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
          "[lifecycleOperationSchema] correctionReasonCode is invalid",
        );
      }
      nullFields([
        "targetUserUid",
        "targetDisplayName",
        "terminationDate",
        "reasonOfTermination",
        "offboardingReason",
      ]);
      break;
    default:
      fail(
        LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.ENUM_INVALID,
        "[lifecycleOperationSchema] operationType is invalid",
      );
  }

  if (record.targetUserUid === null && record.targetDisplayName !== null) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] target display requires target UID",
    );
  }
  if (record.targetUserUid !== null) {
    assertDocumentId(record.targetUserUid, "targetUserUid");
    assertTrimmedText(record.targetDisplayName, "targetDisplayName", 6);
  }
}

function assertOperationStateShape(record) {
  const registeredDeletion = record.targetUserUid !== null;
  if (!registeredDeletion) {
    if (
      record.state !== LIFECYCLE_OPERATION_STATES.COMPLETED ||
      record.authDisposition !== LIFECYCLE_AUTH_DISPOSITIONS.NOT_APPLICABLE ||
      record.cleanupState !== LIFECYCLE_CLEANUP_STATES.NOT_APPLICABLE ||
      record.lastErrorPhase !== null ||
      record.lastErrorCode !== null ||
      record.completedAt === null
    ) {
      fail(
        LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
        "[lifecycleOperationSchema] non-registered operation state is invalid",
      );
    }
    return;
  }

  const authDeleted = [
    LIFECYCLE_AUTH_DISPOSITIONS.DELETED,
    LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT,
  ].includes(record.authDisposition);
  if (authDeleted !== (record.authDeletedAt !== null)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] Auth disposition and timestamp are inconsistent",
    );
  }

  if (
    record.state === LIFECYCLE_OPERATION_STATES.COMPLETED &&
    (!authDeleted ||
      record.cleanupState !== LIFECYCLE_CLEANUP_STATES.COMPLETED ||
      record.dataFinalizedAt === null ||
      record.completedAt === null ||
      record.lastErrorPhase !== null)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] completed deletion state is invalid",
    );
  }
  if (
    record.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED &&
    (!authDeleted ||
      ![
        LIFECYCLE_CLEANUP_STATES.PENDING,
        LIFECYCLE_CLEANUP_STATES.FAILED,
      ].includes(record.cleanupState) ||
      record.dataFinalizedAt === null ||
      record.completedAt !== null)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] data-finalized state is invalid",
    );
  }
  if (
    [
      LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
      LIFECYCLE_OPERATION_STATES.ACCESS_REVOKED,
    ].includes(record.state) &&
    (record.authDisposition !== LIFECYCLE_AUTH_DISPOSITIONS.PRESENT ||
      record.cleanupState !== LIFECYCLE_CLEANUP_STATES.PENDING ||
      record.authDeletedAt !== null ||
      record.dataFinalizedAt !== null ||
      record.completedAt !== null)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] access revoke state is invalid",
    );
  }
  if (
    record.state === LIFECYCLE_OPERATION_STATES.AUTH_DELETE_INTENT &&
    (record.cleanupState !== LIFECYCLE_CLEANUP_STATES.PENDING ||
      record.dataFinalizedAt !== null ||
      record.completedAt !== null)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] Auth delete intent state is invalid",
    );
  }

  const failureState =
    record.state === LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE ||
    (record.state === LIFECYCLE_OPERATION_STATES.DATA_FINALIZED &&
      record.cleanupState === LIFECYCLE_CLEANUP_STATES.FAILED);
  if (failureState !== (record.lastErrorPhase !== null)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] failure metadata is inconsistent",
    );
  }
  if (
    record.state === LIFECYCLE_OPERATION_STATES.FAILED_RETRYABLE &&
    (record.cleanupState !== LIFECYCLE_CLEANUP_STATES.PENDING ||
      record.dataFinalizedAt !== null ||
      record.completedAt !== null)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] retryable failure state is invalid",
    );
  }
}

export function assertLifecycleOperationRecord(record) {
  assertExactFields(record, OPERATION_FIELDS, "operation");
  if (record.schemaVersion !== 1) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] schemaVersion must be 1",
    );
  }
  assertUuid(record.operationId, "operationId");
  assertEnum(record.operationType, OPERATION_TYPE_VALUES, "operationType");
  assertEnum(record.state, OPERATION_STATE_VALUES, "state");
  assertDocumentId(record.actorUid, "actorUid");
  assertTrimmedText(record.actorDisplayName, "actorDisplayName", 6);
  assertNullableDocumentId(record.employeeId, "employeeId");
  assertNullableDocumentId(record.targetUserUid, "targetUserUid");
  assertTrimmedText(record.targetDisplayName, "targetDisplayName", 6, true);
  assertNullableUuid(record.reversesOperationId, "reversesOperationId");
  if (
    record.terminationDate !== null &&
    (typeof record.terminationDate !== "string" ||
      !DATE_ONLY_PATTERN.test(record.terminationDate))
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] terminationDate is invalid",
    );
  }
  assertTrimmedText(
    record.reasonOfTermination,
    "reasonOfTermination",
    20,
    true,
  );
  assertTrimmedText(record.offboardingReason, "offboardingReason", 20, true);
  if (
    record.correctionReasonCode !== null &&
    record.correctionReasonCode !== "MISTAKEN_RETIREMENT"
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] correctionReasonCode is invalid",
    );
  }
  if (
    typeof record.requestFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(record.requestFingerprint)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] requestFingerprint is invalid",
    );
  }
  assertEnum(
    record.authDisposition,
    AUTH_DISPOSITION_VALUES,
    "authDisposition",
  );
  assertEnum(record.cleanupState, CLEANUP_STATE_VALUES, "cleanupState");
  if (!Number.isInteger(record.attemptCount) || record.attemptCount < 0) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] attemptCount is invalid",
    );
  }
  assertEnum(record.lastErrorPhase, EVENT_PHASE_VALUES, "lastErrorPhase", true);
  assertEnum(
    record.lastErrorCode,
    DOMAIN_ERROR_CODE_VALUES,
    "lastErrorCode",
    true,
  );
  if ((record.lastErrorPhase === null) !== (record.lastErrorCode === null)) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] error phase and code must both be null or set",
    );
  }
  assertTimestamp(record.createdAt, "createdAt");
  assertTimestamp(record.updatedAt, "updatedAt");
  assertTimestamp(record.authDeletedAt, "authDeletedAt", true);
  assertTimestamp(record.dataFinalizedAt, "dataFinalizedAt", true);
  assertTimestamp(record.completedAt, "completedAt", true);
  assertTypeSpecificOperation(record);
  assertOperationStateShape(record);
  return record;
}

export function assertLifecycleEventRecord(event) {
  assertExactFields(event, EVENT_FIELDS, "event");
  assertEnum(event.phase, EVENT_PHASE_VALUES, "phase");
  if (!Number.isInteger(event.attempt) || event.attempt < 1) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.EVENT_SHAPE_INVALID,
      "[lifecycleOperationSchema] event attempt is invalid",
    );
  }
  assertEnum(event.outcome, EVENT_OUTCOME_VALUES, "outcome");
  assertEnum(event.errorCode, DOMAIN_ERROR_CODE_VALUES, "errorCode", true);
  if (
    (event.outcome === LIFECYCLE_EVENT_OUTCOMES.FAILED_RETRYABLE) !==
    (event.errorCode !== null)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.EVENT_SHAPE_INVALID,
      "[lifecycleOperationSchema] event errorCode does not match outcome",
    );
  }
  assertTimestamp(event.at, "at");
  return event;
}

export function assertLifecycleLockRecord(lock) {
  assertExactFields(lock, LOCK_FIELDS, "lock");
  assertUuid(lock.operationId, "operationId");
  assertEnum(lock.operationType, OPERATION_TYPE_VALUES, "operationType");
  assertTimestamp(lock.createdAt, "createdAt");
  return lock;
}

export function assertEmployeeLifecycleHeadRecord(head) {
  assertExactFields(head, HEAD_FIELDS, "head");
  if (!Number.isInteger(head.revision) || head.revision < 1) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.HEAD_SHAPE_INVALID,
      "[lifecycleOperationSchema] head revision is invalid",
    );
  }
  assertUuid(head.latestOperationId, "latestOperationId");
  if (
    ![
      LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
      LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT,
    ].includes(head.latestOperationType)
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.HEAD_SHAPE_INVALID,
      "[lifecycleOperationSchema] latestOperationType is invalid",
    );
  }
  assertTimestamp(head.updatedAt, "updatedAt");
  return head;
}

export function createLifecycleRequestFingerprint({
  actorUid,
  operationType,
  normalizedInput,
} = {}) {
  assertDocumentId(actorUid, "actorUid");
  assertEnum(operationType, OPERATION_TYPE_VALUES, "operationType");
  const fields = FINGERPRINT_FIELDS[operationType];
  assertExactFields(normalizedInput, fields, "normalizedInput");
  switch (operationType) {
    case LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT:
      assertDocumentId(normalizedInput.employeeId, "employeeId");
      if (!DATE_ONLY_PATTERN.test(normalizedInput.terminationDate ?? "")) {
        fail(
          LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.INPUT_INVALID,
          "[lifecycleOperationSchema] terminationDate is invalid",
        );
      }
      assertTrimmedText(
        normalizedInput.reasonOfTermination,
        "reasonOfTermination",
        20,
      );
      break;
    case LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION:
      assertDocumentId(normalizedInput.targetUserId, "targetUserId");
      assertTrimmedText(normalizedInput.reason, "reason", 20);
      break;
    case LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT:
      assertDocumentId(normalizedInput.employeeId, "employeeId");
      assertUuid(normalizedInput.reversesOperationId, "reversesOperationId");
      if (normalizedInput.correctionReasonCode !== "MISTAKEN_RETIREMENT") {
        fail(
          LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.INPUT_INVALID,
          "[lifecycleOperationSchema] correctionReasonCode is invalid",
        );
      }
      break;
    default:
      break;
  }
  const canonical = { actorUid, operationType };
  for (const field of fields) canonical[field] = normalizedInput[field];
  return createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}

export function createRegisteredUserDeletionOperationRecord({
  operationId,
  operationType,
  actorUid,
  actorDisplayName,
  employeeId = null,
  targetUserUid,
  targetDisplayName,
  terminationDate = null,
  reasonOfTermination = null,
  offboardingReason = null,
  requestFingerprint,
  timestamp,
} = {}) {
  if (
    operationType !== LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT &&
    operationType !==
      LIFECYCLE_OPERATION_TYPES.STANDALONE_REGISTERED_USER_DELETION
  ) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.OPERATION_SHAPE_INVALID,
      "[lifecycleOperationSchema] registered deletion type is invalid",
    );
  }
  assertDocumentId(targetUserUid, "targetUserUid");
  assertTrimmedText(targetDisplayName, "targetDisplayName", 6);
  const record = {
    schemaVersion: 1,
    operationId,
    operationType,
    state: LIFECYCLE_OPERATION_STATES.ACCESS_REVOKE_PENDING,
    actorUid,
    actorDisplayName,
    employeeId,
    targetUserUid,
    targetDisplayName,
    reversesOperationId: null,
    terminationDate,
    reasonOfTermination,
    offboardingReason,
    correctionReasonCode: null,
    requestFingerprint,
    authDisposition: LIFECYCLE_AUTH_DISPOSITIONS.PRESENT,
    cleanupState: LIFECYCLE_CLEANUP_STATES.PENDING,
    attemptCount: 0,
    lastErrorPhase: null,
    lastErrorCode: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    authDeletedAt: null,
    dataFinalizedAt: null,
    completedAt: null,
  };
  return Object.freeze(assertLifecycleOperationRecord(record));
}

export function createEmployeeOnlyRetirementOperationRecord({
  operationId,
  actorUid,
  actorDisplayName,
  employeeId,
  terminationDate,
  reasonOfTermination,
  requestFingerprint,
  timestamp,
} = {}) {
  const record = {
    schemaVersion: 1,
    operationId,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_RETIREMENT,
    state: LIFECYCLE_OPERATION_STATES.COMPLETED,
    actorUid,
    actorDisplayName,
    employeeId,
    targetUserUid: null,
    targetDisplayName: null,
    reversesOperationId: null,
    terminationDate,
    reasonOfTermination,
    offboardingReason: null,
    correctionReasonCode: null,
    requestFingerprint,
    authDisposition: LIFECYCLE_AUTH_DISPOSITIONS.NOT_APPLICABLE,
    cleanupState: LIFECYCLE_CLEANUP_STATES.NOT_APPLICABLE,
    attemptCount: 1,
    lastErrorPhase: null,
    lastErrorCode: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    authDeletedAt: null,
    dataFinalizedAt: null,
    completedAt: timestamp,
  };
  return Object.freeze(assertLifecycleOperationRecord(record));
}

export function createEmployeeReinstatementOperationRecord({
  operationId,
  actorUid,
  actorDisplayName,
  employeeId,
  reversesOperationId,
  correctionReasonCode,
  requestFingerprint,
  timestamp,
} = {}) {
  const record = {
    schemaVersion: 1,
    operationId,
    operationType: LIFECYCLE_OPERATION_TYPES.EMPLOYEE_REINSTATEMENT,
    state: LIFECYCLE_OPERATION_STATES.COMPLETED,
    actorUid,
    actorDisplayName,
    employeeId,
    targetUserUid: null,
    targetDisplayName: null,
    reversesOperationId,
    terminationDate: null,
    reasonOfTermination: null,
    offboardingReason: null,
    correctionReasonCode,
    requestFingerprint,
    authDisposition: LIFECYCLE_AUTH_DISPOSITIONS.NOT_APPLICABLE,
    cleanupState: LIFECYCLE_CLEANUP_STATES.NOT_APPLICABLE,
    attemptCount: 1,
    lastErrorPhase: null,
    lastErrorCode: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    authDeletedAt: null,
    dataFinalizedAt: null,
    completedAt: timestamp,
  };
  return Object.freeze(assertLifecycleOperationRecord(record));
}

export function createLifecycleEventRecord({
  phase,
  attempt,
  outcome,
  errorCode = null,
  timestamp,
} = {}) {
  return Object.freeze(
    assertLifecycleEventRecord({
      phase,
      attempt,
      outcome,
      errorCode,
      at: timestamp,
    }),
  );
}

export function createLifecycleLockRecord({
  operationId,
  operationType,
  timestamp,
} = {}) {
  return Object.freeze(
    assertLifecycleLockRecord({
      operationId,
      operationType,
      createdAt: timestamp,
    }),
  );
}

export function createNextEmployeeLifecycleHead({
  currentHead = null,
  operationId,
  operationType,
  timestamp,
} = {}) {
  if (currentHead !== null) assertEmployeeLifecycleHeadRecord(currentHead);
  const head = {
    revision: (currentHead?.revision ?? 0) + 1,
    latestOperationId: operationId,
    latestOperationType: operationType,
    updatedAt: timestamp,
  };
  return Object.freeze(assertEmployeeLifecycleHeadRecord(head));
}

export function lifecycleOperationPath(companyId, operationId) {
  assertDocumentId(companyId, "companyId");
  assertUuid(operationId, "operationId");
  return `Companies/${companyId}/LifecycleOperations/${operationId}`;
}

export function lifecycleEventPath(companyId, operationId, phase, attempt) {
  assertEnum(phase, EVENT_PHASE_VALUES, "phase");
  if (!Number.isInteger(attempt) || attempt < 1) {
    fail(
      LIFECYCLE_OPERATION_SCHEMA_ERROR_CODES.EVENT_SHAPE_INVALID,
      "[lifecycleOperationSchema] event attempt is invalid",
    );
  }
  return `${lifecycleOperationPath(companyId, operationId)}/Events/${phase}-${attempt}`;
}

export function userLifecycleLockPath(companyId, targetUserUid) {
  assertDocumentId(companyId, "companyId");
  assertDocumentId(targetUserUid, "targetUserUid");
  return `Companies/${companyId}/UserLifecycleLocks/${targetUserUid}`;
}

export function employeeLifecycleLockPath(companyId, employeeId) {
  assertDocumentId(companyId, "companyId");
  assertDocumentId(employeeId, "employeeId");
  return `Companies/${companyId}/EmployeeLifecycleLocks/${employeeId}`;
}

export function employeeLifecycleHeadPath(companyId, employeeId) {
  assertDocumentId(companyId, "companyId");
  assertDocumentId(employeeId, "employeeId");
  return `Companies/${companyId}/EmployeeLifecycleHeads/${employeeId}`;
}
