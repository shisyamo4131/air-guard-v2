import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onOperationResultChange } from "../triggers/operationResult.js";

export function codexOperationResultEnabled(environment = process.env) {
  if (environment.AIR_GUARD_CODEX_OPERATION_RESULT_TRIGGER !== "enabled") return false;
  if (environment.GCLOUD_PROJECT !== "demo-air-guard-v2-codex" || environment.FUNCTIONS_EMULATOR !== "true"
      || environment.AIR_GUARD_EXTERNAL_EFFECTS !== "deny" || !/^127\.0\.0\.1:\d+$/u.test(environment.FIRESTORE_EMULATOR_HOST || "")) throw new Error("Dedicated operation trigger environment is invalid");
  return true;
}

// Registration is present in this dedicated entry; execution is opt-in. The
// normal API harness keeps the flag absent and must produce no background data.
export const codexOnOperationResultChange = onDocumentWritten("Companies/{companyId}/OperationResults/{docId}", async (event) => {
  if (!codexOperationResultEnabled()) return;
  return onOperationResultChange.run(event);
});
