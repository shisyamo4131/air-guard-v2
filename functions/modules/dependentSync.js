import { getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/firestore";

export const onUpdateCustomer = onDocumentUpdated(
  "Companies/{companyId}/Customers/{customerId}",
  async (event) => {
    const companyId = event.params.companyId;
    const customerId = event.params.customerId;
    const data = event.data.after.data();

    const db = getFirestore();
    const colRef = db.collection(`Companies/${companyId}/Sites`);
    const queryRef = colRef.where("customerId", "==", customerId);
    const querySnapshot = await queryRef.get();
    if (querySnapshot.empty) {
      return null;
    }
    const batchSize = 300;
    const batchArray = [];

    querySnapshot.docs.forEach((doc, index) => {
      if (index % batchSize === 0) batchArray.push(db.batch());
      batchArray[batchArray.length - 1].update(doc.ref, { customer: data });
    });

    await Promise.all(batchArray.map((batch) => batch.commit()));

    return null;
  }
);
