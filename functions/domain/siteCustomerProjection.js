import { Timestamp } from "firebase-admin/firestore";

export const SITE_CUSTOMER_PROJECTION_FIELDS = Object.freeze([
  "docId",
  "updatedAt",
  "code",
  "name",
  "abbreviation",
  "cutoffDate",
]);

const CUTOFF_DATES = new Set([0, 5, 10, 15, 20, 25]);

function assertRequiredString(value, field, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new TypeError(`Invalid Customer projection field: ${field}`);
  }
}

function assertNullableString(value, field, maxLength) {
  if (value !== null && (typeof value !== "string" || value.length > maxLength)) {
    throw new TypeError(`Invalid Customer projection field: ${field}`);
  }
}

export function createSiteCustomerProjection(customerData, customerId) {
  if (!customerData || typeof customerData !== "object" || Array.isArray(customerData)) {
    throw new TypeError("Invalid Customer projection source");
  }
  for (const field of SITE_CUSTOMER_PROJECTION_FIELDS) {
    if (!Object.hasOwn(customerData, field)) {
      throw new TypeError(`Missing Customer projection field: ${field}`);
    }
  }

  assertRequiredString(customerData.docId, "docId", 128);
  if (customerData.docId !== customerId) {
    throw new TypeError("Customer projection document ID does not match its path");
  }
  if (!(customerData.updatedAt instanceof Timestamp)) {
    throw new TypeError("Invalid Customer projection field: updatedAt");
  }
  assertNullableString(customerData.code, "code", 10);
  assertRequiredString(customerData.name, "name", 20);
  assertRequiredString(customerData.abbreviation, "abbreviation", 20);
  if (!Number.isInteger(customerData.cutoffDate) ||
      !CUTOFF_DATES.has(customerData.cutoffDate)) {
    throw new TypeError("Invalid Customer projection field: cutoffDate");
  }

  return Object.fromEntries(
    SITE_CUSTOMER_PROJECTION_FIELDS.map((field) => [field, customerData[field]]),
  );
}
