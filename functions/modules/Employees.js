import { onDocumentDeleted } from "firebase-functions/v2/firestore";

// Retain the deployed trigger name/path so an older queued deletion event also
// has no authority to delete linked User/Auth state. Lifecycle owns offboarding.
export const onEmployeeDeleted = onDocumentDeleted(
  "Companies/{companyId}/Employees/{docId}",
  async () => undefined,
);