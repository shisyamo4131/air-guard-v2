import { FieldValue } from "firebase-admin/firestore";
import { equal } from "../../shared/employeeContract.js";
import { OperationWriteError } from "../../shared/operationReferences.js";
import { parsePaymentInput, paymentActorAllowed, paymentExpected, paymentPatch, paymentMatches } from "../../shared/billingPaymentContract.js";

export async function updateBillingPaymentDate({ firestore, resolveIdentity, input }) {
  const command = parsePaymentInput(input), initial = await resolveIdentity();
  return firestore.runTransaction(async (transaction) => {
    const identity = await resolveIdentity();
    if (initial.uid !== identity.uid || initial.companyId !== identity.companyId) throw new OperationWriteError("permission-denied");
    const root = `Companies/${identity.companyId}`, actor = await transaction.get(firestore.doc(`${root}/Users/${identity.uid}`));
    if (!actor.exists || !paymentActorAllowed(identity, actor.data())) throw new OperationWriteError("permission-denied");
    const ref = firestore.doc(`${root}/Billings/${command.documentId}`), snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new OperationWriteError("not-found", "請求情報が見つかりません。");
    const raw = snapshot.data();
    if (raw.docId !== command.documentId) throw new OperationWriteError("failed-precondition");
    if (!equal(paymentExpected(raw), command.expected)) throw new OperationWriteError("aborted", "情報が更新されました。入力を保持しています。再読込してください。");
    const patch = paymentPatch(raw, command.paymentDueDate);
    if (paymentMatches(raw, patch)) return { success: true, updated: false };
    transaction.update(ref, { ...patch, uid: identity.uid, updatedAt: FieldValue.serverTimestamp() });
    return { success: true, updated: true };
  });
}
