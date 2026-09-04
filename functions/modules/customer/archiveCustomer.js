/*****************************************************************************
 * @file ./functions/modules/customer/archiveCustomer.js
 * @description 参照のないCustomerを監査付きでarchiveします。
 *****************************************************************************/
import { FieldValue } from "firebase-admin/firestore";
import { resolveRolePermissions } from "../auth/policies/rolePermissions.js";
import {
  buildCustomerArchiveEnvelope,
  isPlainObject,
  isServerTimestampSentinel,
  isValidCustomerArchiveEnvelope,
  isValidCustomerArchiveSnapshot,
} from "./customerArchiveDocumentContract.js";

export const CUSTOMER_ARCHIVE_ERROR_CODES = Object.freeze({
  INVALID_INPUT: "invalid-input",
  INVALID_DEPENDENCY: "invalid-dependency",
  ACTOR_NOT_ALLOWED: "actor-not-allowed",
  CUSTOMER_NOT_FOUND: "customer-not-found",
  CUSTOMER_INVALID: "customer-invalid",
  REFERENCES_EXIST: "references-exist",
  ARCHIVE_INVALID: "archive-invalid",
  ARCHIVE_CONFLICT: "archive-conflict",
});

export class CustomerArchiveError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "CustomerArchiveError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new CustomerArchiveError(code, message, options);
}

function enumerableOwnKeys(value) {
  return Reflect.ownKeys(value).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key),
  );
}

function assertSafeIdentifier(value, name) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    value.trim() !== value ||
    value.includes("/") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
      `[archiveCustomer] ${name} is invalid`,
    );
  }
}

function normalizeInputString(value, maxLength, field) {
  if (typeof value !== "string") {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT,
      `[archiveCustomer] ${field} must be a string`,
    );
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT,
      `[archiveCustomer] ${field} length is invalid`,
    );
  }
  return normalized;
}

export function parseCustomerArchiveInput(input) {
  const expectedKeys = ["customerId", "reason", "operationId"];
  if (!isPlainObject(input)) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT,
      "[archiveCustomer] Input must be a plain object",
    );
  }
  const keys = enumerableOwnKeys(input);
  if (
    keys.length !== expectedKeys.length ||
    keys.some(
      (key) => typeof key !== "string" || !expectedKeys.includes(key),
    ) ||
    expectedKeys.some((key) => !Object.hasOwn(input, key))
  ) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT,
      "[archiveCustomer] Input fields are invalid",
    );
  }

  const customerId = normalizeInputString(input.customerId, 128, "customerId");
  const reason = normalizeInputString(input.reason, 200, "reason");
  const operationId = normalizeInputString(
    input.operationId,
    128,
    "operationId",
  );

  if (customerId.includes("/") || /[\u0000-\u001f\u007f]/u.test(customerId)) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_INPUT,
      "[archiveCustomer] customerId is not path-safe",
    );
  }

  return Object.freeze({ customerId, reason, operationId });
}

function assertDependencies(firestore, identity, serverTimestampFactory) {
  if (
    !firestore ||
    typeof firestore.doc !== "function" ||
    typeof firestore.collection !== "function" ||
    typeof firestore.runTransaction !== "function" ||
    typeof serverTimestampFactory !== "function" ||
    !isPlainObject(identity) ||
    typeof identity.isSuperUser !== "boolean"
  ) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
      "[archiveCustomer] Dependencies are invalid",
    );
  }
  assertSafeIdentifier(identity.uid, "actorUid");
  assertSafeIdentifier(identity.companyId, "companyId");
}

function assertActor(identity, actorUser) {
  if (
    !isPlainObject(actorUser) ||
    actorUser.companyId !== identity.companyId ||
    actorUser.isTemporary !== false ||
    actorUser.disabled !== false ||
    typeof actorUser.isAdmin !== "boolean"
  ) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[archiveCustomer] Actor is not active in the Company",
    );
  }

  if (actorUser.isAdmin === true) return;
  if (identity.isSuperUser !== false) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[archiveCustomer] Super-user lacks Company administrator authority",
    );
  }

  let permissions;
  try {
    permissions = resolveRolePermissions(actorUser.roles);
  } catch {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[archiveCustomer] Actor roles are not approved presets",
    );
  }
  if (!permissions.includes("customers:write")) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.ACTOR_NOT_ALLOWED,
      "[archiveCustomer] Actor lacks Customer write permission",
    );
  }
}

function assertDocumentSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    typeof snapshot.exists !== "boolean" ||
    (snapshot.exists && typeof snapshot.data !== "function")
  ) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
      "[archiveCustomer] Document snapshot is invalid",
    );
  }
}

function querySnapshotSize(snapshot) {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    !Number.isSafeInteger(snapshot.size) ||
    snapshot.size < 0 ||
    snapshot.size > 1
  ) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
      "[archiveCustomer] Query snapshot is invalid",
    );
  }
  return snapshot.size;
}

function createLimitedReferenceQuery(firestore, path, customerId) {
  try {
    const collection = firestore.collection(path);
    if (!collection || typeof collection.where !== "function") throw new TypeError();
    const filtered = collection.where("customerId", "==", customerId);
    if (!filtered || typeof filtered.limit !== "function") throw new TypeError();
    const query = filtered.limit(1);
    if (!query || typeof query !== "object") throw new TypeError();
    return query;
  } catch (error) {
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
      "[archiveCustomer] Reference query dependency is invalid",
      { cause: error },
    );
  }
}

function createTargets(firestore, companyId, actorUid, customerId) {
  try {
    const actorRef = firestore.doc(`Companies/${companyId}/Users/${actorUid}`);
    const activeRef = firestore.doc(
      `Companies/${companyId}/Customers/${customerId}`,
    );
    const archiveRef = firestore.doc(
      `Companies/${companyId}/Customers_archive/${customerId}`,
    );
    if (![actorRef, activeRef, archiveRef].every((ref) => ref && typeof ref === "object")) {
      throw new TypeError();
    }
    return {
      actorRef,
      activeRef,
      archiveRef,
      referenceQueries: ["Sites", "OperationResults", "Billings"].map(
        (collectionName) =>
          createLimitedReferenceQuery(
            firestore,
            `Companies/${companyId}/${collectionName}`,
            customerId,
          ),
      ),
    };
  } catch (error) {
    if (error instanceof CustomerArchiveError) throw error;
    fail(
      CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
      "[archiveCustomer] Firestore references are invalid",
      { cause: error },
    );
  }
}

function snapshotData(snapshot, invalidCode) {
  try {
    return snapshot.data();
  } catch (error) {
    fail(invalidCode, "[archiveCustomer] Persisted document is unreadable", {
      cause: error,
    });
  }
}

/**
 * Customer archive transactionを実行します。
 */
export async function archiveCustomer({
  firestore,
  identity,
  input,
  serverTimestampFactory = () => FieldValue.serverTimestamp(),
} = {}) {
  assertDependencies(firestore, identity, serverTimestampFactory);
  const { customerId, reason, operationId } = parseCustomerArchiveInput(input);
  const targets = createTargets(
    firestore,
    identity.companyId,
    identity.uid,
    customerId,
  );

  await firestore.runTransaction(async (transaction) => {
    if (
      !transaction ||
      typeof transaction.get !== "function" ||
      typeof transaction.create !== "function" ||
      typeof transaction.delete !== "function"
    ) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
        "[archiveCustomer] Transaction dependency is invalid",
      );
    }

    const actorSnapshot = await transaction.get(targets.actorRef);
    const activeSnapshot = await transaction.get(targets.activeRef);
    const archiveSnapshot = await transaction.get(targets.archiveRef);
    const siteSnapshot = await transaction.get(targets.referenceQueries[0]);
    const operationResultSnapshot = await transaction.get(
      targets.referenceQueries[1],
    );
    const billingSnapshot = await transaction.get(targets.referenceQueries[2]);

    for (const snapshot of [actorSnapshot, activeSnapshot, archiveSnapshot]) {
      assertDocumentSnapshot(snapshot);
    }
    assertActor(
      identity,
      actorSnapshot.exists
        ? snapshotData(
            actorSnapshot,
            CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
          )
        : null,
    );

    if (
      [siteSnapshot, operationResultSnapshot, billingSnapshot].some(
        (snapshot) => querySnapshotSize(snapshot) > 0,
      )
    ) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.REFERENCES_EXIST,
        "[archiveCustomer] Customer references exist",
      );
    }

    if (activeSnapshot.exists && archiveSnapshot.exists) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT,
        "[archiveCustomer] Active and archive documents both exist",
      );
    }
    if (!activeSnapshot.exists && !archiveSnapshot.exists) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_NOT_FOUND,
        "[archiveCustomer] Customer was not found",
      );
    }

    if (archiveSnapshot.exists) {
      const archive = snapshotData(
        archiveSnapshot,
        CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID,
      );
      if (!isValidCustomerArchiveEnvelope(archive, customerId)) {
        fail(
          CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_INVALID,
          "[archiveCustomer] Existing archive is invalid",
        );
      }
      if (
        archive.audit.actorUid !== identity.uid ||
        archive.audit.operationId !== operationId ||
        archive.audit.reason !== reason
      ) {
        fail(
          CUSTOMER_ARCHIVE_ERROR_CODES.ARCHIVE_CONFLICT,
          "[archiveCustomer] Existing archive does not match this operation",
        );
      }
      return;
    }

    const customer = snapshotData(
      activeSnapshot,
      CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_INVALID,
    );
    if (!isValidCustomerArchiveSnapshot(customer, customerId)) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.CUSTOMER_INVALID,
        "[archiveCustomer] Active Customer is invalid",
      );
    }

    let archivedAt;
    try {
      archivedAt = serverTimestampFactory();
    } catch (error) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
        "[archiveCustomer] Server timestamp dependency failed",
        { cause: error },
      );
    }
    if (!isServerTimestampSentinel(archivedAt)) {
      fail(
        CUSTOMER_ARCHIVE_ERROR_CODES.INVALID_DEPENDENCY,
        "[archiveCustomer] Server timestamp dependency is invalid",
      );
    }

    const envelope = buildCustomerArchiveEnvelope({
      customer,
      customerId,
      operationId,
      reason,
      actorUid: identity.uid,
      archivedAt,
    });
    transaction.create(targets.archiveRef, envelope);
    transaction.delete(targets.activeRef);
  });

  return Object.freeze({ success: true, archived: true });
}
