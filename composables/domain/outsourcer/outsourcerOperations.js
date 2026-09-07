import { Outsourcer } from "../../../schemas/index.js";

export const OUTSOURCER_OPERATION = Object.freeze({
  CREATE: "CREATE",
  UPDATE: "UPDATE",
});

export const OUTSOURCER_BUSINESS_FIELDS = Object.freeze([
  "code",
  "name",
  "nameKana",
  "displayName",
  "contractStatus",
  "remarks",
]);

export const OUTSOURCER_CREATE_FIELDS = Object.freeze(
  OUTSOURCER_BUSINESS_FIELDS.filter((field) => field !== "contractStatus"),
);

const OPERATION_FIELDS = Object.freeze({
  [OUTSOURCER_OPERATION.CREATE]: OUTSOURCER_CREATE_FIELDS,
  [OUTSOURCER_OPERATION.UPDATE]: OUTSOURCER_BUSINESS_FIELDS,
});

export class OutsourcerOperationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OutsourcerOperationError";
    this.code = code;
  }
}

function cloneValue(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  }
  return value;
}

export function outsourcerOperationFields(operation) {
  const fields = OPERATION_FIELDS[operation];
  if (!fields) {
    throw new OutsourcerOperationError(
      "invalid-operation",
      "外注先の操作内容を確認してください。",
    );
  }
  return fields;
}

export function outsourcerOperationSchema(operation) {
  const schemaByKey = new Map(
    Outsourcer.schema.map((definition) => [definition.key, definition]),
  );
  return outsourcerOperationFields(operation).map((field) => schemaByKey.get(field));
}

export function outsourcerSnapshot(source = {}, operation = OUTSOURCER_OPERATION.UPDATE) {
  return Object.fromEntries(
    outsourcerOperationFields(operation).map((field) => [
      field,
      cloneValue(source?.[field] ?? null),
    ]),
  );
}

export function outsourcerSnapshotsEqual(left, right, operation = OUTSOURCER_OPERATION.UPDATE) {
  return outsourcerOperationFields(operation).every((field) =>
    Object.is(left?.[field] ?? null, right?.[field] ?? null),
  );
}

export function changedOutsourcerFields({ baseline, draft }) {
  return OUTSOURCER_BUSINESS_FIELDS.filter(
    (field) => !Object.is(baseline?.[field] ?? null, draft?.[field] ?? null),
  );
}

export function conflictingOutsourcerFields({ baseline, latest, draft }) {
  return changedOutsourcerFields({ baseline, draft }).filter(
    (field) => !Object.is(baseline?.[field] ?? null, latest?.[field] ?? null),
  );
}

export function hasOutsourcerOperationConflict(args) {
  return conflictingOutsourcerFields(args).length > 0;
}

function assertString(value, field, { required = false, max }) {
  if (value == null) {
    if (!required) return;
    throw new OutsourcerOperationError(
      "invalid-outsourcer",
      `${field}を入力してください。`,
    );
  }
  if (
    typeof value !== "string" ||
    (required && value.length === 0) ||
    value.length > max
  ) {
    throw new OutsourcerOperationError(
      "invalid-outsourcer",
      `${field}の入力内容を確認してください。`,
    );
  }
}

export function validateOutsourcerCandidate(candidate) {
  if (!(candidate instanceof Outsourcer)) {
    throw new OutsourcerOperationError(
      "invalid-outsourcer",
      "外注先の入力内容を確認してください。",
    );
  }
  try {
    candidate.validate();
  } catch (error) {
    const first = error?.validationErrors?.[0];
    throw new OutsourcerOperationError(
      "invalid-outsourcer",
      first?.messages?.ja || "外注先の入力内容を確認してください。",
    );
  }
  assertString(candidate.code, "外注先コード", { max: 10 });
  assertString(candidate.name, "外注先名", { required: true, max: 20 });
  assertString(candidate.nameKana, "外注先名（カナ）", {
    required: true,
    max: 40,
  });
  assertString(candidate.displayName, "略称", { required: true, max: 6 });
  assertString(candidate.remarks, "備考", { max: 200 });
  if (![Outsourcer.STATUS_ACTIVE, Outsourcer.STATUS_TERMINATED].includes(candidate.contractStatus)) {
    throw new OutsourcerOperationError(
      "invalid-outsourcer",
      "外注先の契約状態を確認してください。",
    );
  }
  return candidate;
}

export function getOutsourcerOperationErrorMessage(error, fallback) {
  return error instanceof OutsourcerOperationError ? error.message : fallback;
}

export async function prepareOutsourcerCreate({ draft, docId, actorUid, now }) {
  const candidate = new Outsourcer(draft?.toObject?.() ?? draft ?? {});
  candidate.docId = docId;
  candidate.uid = actorUid;
  candidate.createdAt = now;
  candidate.updatedAt = now;
  candidate.contractStatus = Outsourcer.STATUS_ACTIVE;
  await candidate.beforeCreate();
  validateOutsourcerCandidate(candidate);
  return candidate;
}

export async function prepareOutsourcerUpdate({
  latest,
  baseline,
  draft,
  actorUid,
  now,
}) {
  if (!(latest instanceof Outsourcer) || !latest.docId) {
    throw new OutsourcerOperationError(
      "not-found",
      "外注先の最新情報を確認できません。",
    );
  }
  const conflictFields = conflictingOutsourcerFields({ baseline, latest, draft });
  if (conflictFields.length > 0) {
    throw new OutsourcerOperationError(
      "conflict",
      "別の画面で同じ外注先情報が更新されました。最新情報を読み直してください。",
    );
  }
  const fields = changedOutsourcerFields({ baseline, draft });
  if (fields.length === 0) {
    return { candidate: new Outsourcer(latest.toObject()), fields: [] };
  }
  const candidate = new Outsourcer(latest.toObject());
  Object.assign(
    candidate,
    Object.fromEntries(fields.map((field) => [field, cloneValue(draft[field])])),
  );
  candidate.uid = actorUid;
  candidate.updatedAt = now;
  await candidate.beforeUpdate();
  if (conflictingOutsourcerFields({ baseline, latest, draft }).length > 0) {
    throw new OutsourcerOperationError(
      "conflict",
      "別の画面で同じ外注先情報が更新されました。最新情報を読み直してください。",
    );
  }
  validateOutsourcerCandidate(candidate);
  return { candidate, fields };
}
