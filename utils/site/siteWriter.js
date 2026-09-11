import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { Site } from "@/schemas";
import { SITE_DOCUMENT_FIELDS } from "./siteDocumentContract.js";
import {
  SITE_ADDRESS_FIELDS,
  SITE_CONSTRUCTION_FIELDS,
  SITE_DISPLAY_NAME_FIELDS,
  SITE_OPERATION,
  SITE_TOKEN_FIELDS,
  SiteOperationError,
  changedSiteFields,
  prepareSiteUpdate,
  siteValuesEqual,
} from "@/composables/domain/site/siteOperations";
import { createSiteCustomerProjection } from "./siteCustomerProjection.js";

function siteCollection(firestore, companyId) {
  return collection(firestore, "Companies", companyId, "Sites");
}

function serializeSite(site) {
  return Site.converter().toFirestore(site);
}

function pick(source, fields) {
  return Object.fromEntries(
    fields.map((field) => {
      if (!Object.hasOwn(source, field)) {
        throw new Error(`現場の保存項目 ${field} を生成できません。`);
      }
      return [field, source[field]];
    }),
  );
}

function derivedPatchFields(operation, fields) {
  const result = new Set(fields);
  if (operation === SITE_OPERATION.UPDATE_BASIC) {
    if (fields.some((field) => SITE_TOKEN_FIELDS.includes(field))) {
      result.add("tokenMap");
    }
    if (fields.some((field) => SITE_DISPLAY_NAME_FIELDS.includes(field))) {
      result.add("displayName");
    }
    if (fields.some((field) => SITE_ADDRESS_FIELDS.includes(field))) {
      result.add("location");
      result.add("geopoint");
      result.add("fullAddress");
      result.add("prefecture");
    }
    if (fields.some((field) => SITE_CONSTRUCTION_FIELDS.includes(field))) {
      result.add("hasConstructionPeriod");
      result.add("hasConstructionPeriodStartAt");
      result.add("hasConstructionPeriodEndAt");
    }
  }
  if (operation === SITE_OPERATION.UPDATE_CUSTOMER) result.add("isTemporary");
  return result;
}

export function createSiteWriter({ firestore }) {
  if (!firestore) throw new Error("Firestoreを利用できません。");

  function reserveDocument(companyId) {
    return doc(siteCollection(firestore, companyId));
  }

  async function create({
    documentReference,
    companyId,
    site,
    assertCanWrite,
  }) {
    return await runTransaction(firestore, async (transaction) => {
      let customerSnapshotData = null;
      if (site.customerId) {
        const customerReference = doc(
          collection(firestore, "Companies", companyId, "Customers"),
          site.customerId,
        );
        const customerSnapshot = await transaction.get(customerReference);
        if (!customerSnapshot.exists()) {
          throw new SiteOperationError(
            "invalid-customer",
            "取引先の最新情報を確認できません。",
          );
        }
        customerSnapshotData = customerSnapshot.data();
        site.customer = customerSnapshotData;
      } else {
        site.customer = null;
      }
      const data = pick(serializeSite(site), SITE_DOCUMENT_FIELDS);
      // Site serialization may normalize a nested Customer. The official writer
      // keeps the exact runtime-minimal projection from the transaction snapshot.
      data.customer = customerSnapshotData
        ? createSiteCustomerProjection(customerSnapshotData)
        : null;
      data.createdAt = serverTimestamp();
      data.updatedAt = serverTimestamp();
      assertCanWrite?.();
      transaction.set(documentReference, data);
      return site;
    });
  }

  async function update({
    companyId,
    operation,
    docId,
    baseline,
    draft,
    actorUid,
    locationPreparation,
    assertCanWrite,
  }) {
    const reference = doc(siteCollection(firestore, companyId), docId);
    return await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) {
        throw new SiteOperationError("not-found", "現場の最新情報を確認できません。");
      }
      const latest = new Site(snapshot.data());
      const fields = changedSiteFields({ operation, baseline, draft });
      if (!fields.length) return { candidate: latest, fields: [], updated: false };

      const customerId = operation === SITE_OPERATION.UPDATE_CUSTOMER
        ? draft.customerId
        : latest.customerId;
      let customer = null;
      let customerSnapshotData = null;
      if (customerId) {
        const customerReference = doc(
          collection(firestore, "Companies", companyId, "Customers"),
          customerId,
        );
        const customerSnapshot = await transaction.get(customerReference);
        if (!customerSnapshot.exists()) {
          throw new SiteOperationError(
            "invalid-customer",
            "取引先の最新情報を確認できません。",
          );
        }
        customerSnapshotData = customerSnapshot.data();
        customer = customerSnapshotData;
      }

      if (locationPreparation) {
        const locationBasisIsCurrent = SITE_ADDRESS_FIELDS.every((field) => {
          const finalValue = fields.includes(field) ? draft[field] : latest[field];
          return siteValuesEqual(locationPreparation.basis[field], finalValue);
        });
        if (!locationBasisIsCurrent) {
          throw new SiteOperationError(
            "location-stale",
            "住所が同時に更新されました。内容を確認してもう一度保存してください。",
          );
        }
      }

      const prepared = prepareSiteUpdate({
        operation,
        latest,
        baseline,
        draft,
        actorUid,
        now: new Date(),
        customer,
        location: locationPreparation?.location,
      });
      const patchFields = derivedPatchFields(operation, prepared.fields);
      // Keep the denormalized Customer projection convergent on every supported
      // Site update without changing customerName or downstream snapshots.
      patchFields.add("customer");
      const patch = pick(serializeSite(prepared.candidate), [...patchFields]);
      if (patchFields.has("customer")) {
        // Override after serialization so excluded Customer fields cannot be
        // reintroduced by the nested model converter.
        patch.customer = customerSnapshotData
          ? createSiteCustomerProjection(customerSnapshotData)
          : null;
      }
      patch.uid = actorUid;
      patch.updatedAt = serverTimestamp();
      assertCanWrite?.();
      transaction.update(reference, patch);
      return { ...prepared, fields: [...patchFields], updated: true };
    });
  }

  return { create, reserveDocument, update };
}
