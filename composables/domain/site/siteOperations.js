export const SITE_OPERATION = Object.freeze({
  UPDATE_AGREEMENTS: "UPDATE_AGREEMENTS",
});

export const SITE_AGREEMENT_FIELDS = Object.freeze(["agreementsV2"]);

const OPERATION_FIELDS = Object.freeze({
  [SITE_OPERATION.UPDATE_AGREEMENTS]: SITE_AGREEMENT_FIELDS,
});

export class SiteOperationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SiteOperationError";
    this.code = code;
  }
}

export function cloneSiteValue(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneSiteValue);
  if (value?.toObject && typeof value.toObject === "function") {
    return cloneSiteValue(value.toObject());
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneSiteValue(item)]),
    );
  }
  return value;
}

export function siteValuesEqual(left, right) {
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime();
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => siteValuesEqual(item, right[index]));
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftObject = left?.toObject ? left.toObject() : left;
    const rightObject = right?.toObject ? right.toObject() : right;
    const leftKeys = Object.keys(leftObject);
    const rightKeys = Object.keys(rightObject);
    return leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.hasOwn(rightObject, key) &&
          siteValuesEqual(leftObject[key], rightObject[key]),
      );
  }
  return Object.is(left ?? null, right ?? null);
}

export function siteOperationFields(operation) {
  const fields = OPERATION_FIELDS[operation];
  if (!fields) {
    throw new SiteOperationError(
      "invalid-operation",
      "現場の操作内容を確認してください。",
    );
  }
  return fields;
}

export function siteSnapshot(source = {}, operation) {
  return Object.fromEntries(
    siteOperationFields(operation).map((field) => [
      field,
      cloneSiteValue(source?.[field] ?? null),
    ]),
  );
}

export function siteSnapshotsEqual(left, right, operation) {
  return siteOperationFields(operation).every((field) =>
    siteValuesEqual(left?.[field], right?.[field]),
  );
}

export function changedSiteFields({ operation, baseline, draft }) {
  return siteOperationFields(operation).filter(
    (field) => !siteValuesEqual(baseline?.[field], draft?.[field]),
  );
}

export function conflictingSiteFields({ operation, baseline, latest, draft }) {
  return changedSiteFields({ operation, baseline, draft }).filter(
    (field) => !siteValuesEqual(baseline?.[field], latest?.[field]),
  );
}

export function getSiteOperationErrorMessage(error, fallback) {
  return error instanceof SiteOperationError || error?.name === "SiteAuthorizationError"
    ? error.message
    : fallback;
}
