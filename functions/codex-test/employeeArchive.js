import { createArchiveEmployeeCallable } from "../apis/archiveEmployee.js";
import { parseArchiveTenants } from "../modules/employees/archiveEmployee.js";
import { archiveFail } from "../shared/employeeArchiveContract.js";

export function demoEmployeeArchiveTenants(environment = process.env) {
  if (environment.GCLOUD_PROJECT !== "demo-air-guard-v2-codex" || environment.FUNCTIONS_EMULATOR !== "true"
      || environment.AIR_GUARD_EXTERNAL_EFFECTS !== "deny" || !/^127\.0\.0\.1:\d+$/u.test(environment.FIRESTORE_EMULATOR_HOST || "")) archiveFail("permission-denied", "この環境ではアーカイブを利用できません。");
  return parseArchiveTenants(environment.AIR_GUARD_CODEX_EMPLOYEE_ARCHIVE_TENANTS);
}
export const archiveEmployee = createArchiveEmployeeCallable(demoEmployeeArchiveTenants);
