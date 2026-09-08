/**
 * Client-only value helpers for draft projection and Callable request encoding.
 * The Functions implementation remains authoritative for validation and writes.
 */

export function plain(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

export function identifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    !value.includes("/")
  );
}

export function encodeExpected(value) {
  if (value === undefined) return ["missing"];
  if (value === null) return ["null"];
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new TypeError("invalid value");
    const seconds = Math.floor(value.getTime() / 1000);
    return [
      "timestamp",
      seconds,
      (value.getTime() - seconds * 1000) * 1000000,
    ];
  }
  if (
    value &&
    Number.isInteger(value.seconds) &&
    Number.isInteger(value.nanoseconds) &&
    typeof value.toDate === "function"
  ) {
    return ["timestamp", value.seconds, value.nanoseconds];
  }
  if (Array.isArray(value)) return ["array", value.map(encodeExpected)];
  if (plain(value)) {
    return [
      "map",
      Object.keys(value)
        .sort()
        .map((key) => [key, encodeExpected(value[key])]),
    ];
  }
  if (
    ["string", "boolean"].includes(typeof value) ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return [typeof value, value];
  }
  throw new TypeError("invalid value");
}

export function equal(left, right) {
  return JSON.stringify(encodeExpected(left)) === JSON.stringify(encodeExpected(right));
}

export function expectedFields(raw, fields) {
  return Object.fromEntries(
    fields.map((field) => [field, encodeExpected(raw[field])]),
  );
}

export function dateInput(value) {
  if (value === null || value === undefined) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : value;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError("invalid date");
  }
  return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

export function parseDate(value) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("invalid date");
  }
  const date = new Date(`${value}T00:00:00+09:00`);
  if (!Number.isFinite(date.getTime()) || dateInput(date) !== value) {
    throw new TypeError("invalid date");
  }
  return date;
}

export function rawForClass(value) {
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(rawForClass);
  if (plain(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, rawForClass(entry)]),
    );
  }
  return value;
}
