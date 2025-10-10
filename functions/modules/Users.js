/*****************************************************************************
 * User document updated trigger
 *****************************************************************************/
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";

export const onUserUpdated = onDocumentUpdated(
  "Companies/{companyId}/Users/{docId}",
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const userId = event.params.docId;

    // Update Authentication user when displayName is changed in Firestore.
    if (beforeData.displayName !== afterData.displayName) {
      const displayName = afterData.displayName;
      await getAuth().updateUser(userId, { displayName });
    }
  }
);
