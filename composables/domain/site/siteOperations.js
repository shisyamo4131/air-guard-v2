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

export function getSiteOperationErrorMessage(error, fallback) {
  return error instanceof SiteOperationError || error?.name === "SiteAuthorizationError"
    ? error.message
    : fallback;
}
