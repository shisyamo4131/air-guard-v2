import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Outsourcer } from "@/schemas";
import {
  OUTSOURCER_DOCUMENT_FIELDS,
  OUTSOURCER_TOKEN_SOURCE_FIELDS,
} from "./outsourcerDocumentContract.js";
import {
  OutsourcerOperationError,
  prepareOutsourcerUpdate,
} from "@/composables/domain/outsourcer/outsourcerOperations";

function outsourcerCollection(firestore, companyId) {
  return collection(firestore, "Companies", companyId, "Outsourcers");
}

function serializeOutsourcer(outsourcer) {
  return Outsourcer.converter().toFirestore(outsourcer);
}

function pick(source, fields) {
  return Object.fromEntries(
    fields.map((field) => {
      if (!Object.prototype.hasOwnProperty.call(source, field)) {
        throw new Error(`外注先の保存項目 ${field} を生成できません。`);
      }
      return [field, source[field]];
    }),
  );
}

export function createOutsourcerWriter({ firestore }) {
  if (!firestore) throw new Error("Firestoreを利用できません。");

  function reserveDocument(companyId) {
    return doc(outsourcerCollection(firestore, companyId));
  }

  async function create({ documentReference, outsourcer }) {
    const data = pick(serializeOutsourcer(outsourcer), OUTSOURCER_DOCUMENT_FIELDS);
    data.createdAt = serverTimestamp();
    data.updatedAt = serverTimestamp();
    await setDoc(documentReference, data);
    return outsourcer;
  }

  async function update({
    companyId,
    docId,
    baseline,
    draft,
    actorUid,
    assertCanWrite,
  }) {
    const reference = doc(outsourcerCollection(firestore, companyId), docId);
    return await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) {
        throw new OutsourcerOperationError(
          "not-found",
          "外注先の最新情報を確認できません。",
        );
      }
      const prepared = await prepareOutsourcerUpdate({
        latest: new Outsourcer(snapshot.data()),
        baseline,
        draft,
        actorUid,
        now: new Date(),
      });
      if (!prepared.fields.length) {
        return { ...prepared, updated: false };
      }
      const patchFields = new Set(prepared.fields);
      if (prepared.fields.some((field) => OUTSOURCER_TOKEN_SOURCE_FIELDS.includes(field))) {
        patchFields.add("tokenMap");
      }
      const patch = pick(serializeOutsourcer(prepared.candidate), [...patchFields]);
      patch.uid = actorUid;
      patch.updatedAt = serverTimestamp();
      assertCanWrite?.();
      transaction.update(reference, patch);
      return { ...prepared, fields: [...patchFields], updated: true };
    });
  }

  return { create, reserveDocument, update };
}
