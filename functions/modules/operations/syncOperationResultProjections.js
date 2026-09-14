import { syncOperationResultToDailyAttendances } from "../dailyAttendances/index.js";
import { syncOperationResultToDailyOperationsByEmployee } from "../dailyOperationsByEmployee/index.js";
import {
  removeOperationResultFromBilling,
  addOperationResultToBilling,
  syncOperationResultToBilling,
} from "../billings/index.js";
import { rebuildHistories } from "../siteEmployeeHistories/rebuildHistories.js";

const defaults = Object.freeze({
  removeOperationResultFromBilling,
  addOperationResultToBilling,
  syncOperationResultToBilling,
  syncOperationResultToDailyAttendances,
  syncOperationResultToDailyOperationsByEmployee,
  rebuildHistories,
});

export async function syncOperationResultProjections({
  companyId,
  before,
  after,
  dependencies = defaults,
  onProjectionFailure = () => {},
}) {
  const tasks = [];
  if (!after) {
    tasks.push(
      ["billing", () => dependencies.removeOperationResultFromBilling({ companyId, operationResult: before })],
      ["daily-attendance", () => dependencies.syncOperationResultToDailyAttendances({ companyId, beforeData: before, afterData: null })],
      ["daily-operations-by-employee", () => dependencies.syncOperationResultToDailyOperationsByEmployee({ companyId, beforeData: before, afterData: null })],
      ["site-employee-histories", () => dependencies.rebuildHistories(companyId, before.siteId, before.employeeIds)],
    );
  } else if (!before) {
    tasks.push(
      ["billing", () => dependencies.addOperationResultToBilling({ companyId, doc: after })],
      ["daily-attendance", () => dependencies.syncOperationResultToDailyAttendances({ companyId, beforeData: null, afterData: after })],
      ["daily-operations-by-employee", () => dependencies.syncOperationResultToDailyOperationsByEmployee({ companyId, beforeData: null, afterData: after })],
      ["site-employee-histories", () => dependencies.rebuildHistories(companyId, after.siteId, after.employeeIds)],
    );
  } else {
    tasks.push(
      ["billing", () => dependencies.syncOperationResultToBilling({ companyId, before, after })],
      ["daily-attendance", () => dependencies.syncOperationResultToDailyAttendances({ companyId, beforeData: before, afterData: after })],
      ["daily-operations-by-employee", () => dependencies.syncOperationResultToDailyOperationsByEmployee({ companyId, beforeData: before, afterData: after })],
      ["site-employee-histories", async () => {
        const employeeIds = [...before.employeeIds, ...after.employeeIds];
        if (before.siteId !== after.siteId || before.date !== after.date) {
          await dependencies.rebuildHistories(companyId, before.siteId, employeeIds);
        }
        await dependencies.rebuildHistories(companyId, after.siteId, employeeIds);
      }],
    );
  }

  const failures = [];
  for (const [projection, task] of tasks) {
    try {
      await task();
    } catch (error) {
      failures.push({ projection, error });
    }
  }
  for (const failure of failures) {
    try {
      onProjectionFailure(failure);
    } catch {
      // Failure reporting must not prevent the remaining projection results
      // from being reported as one sanitized synchronization failure.
    }
  }
  if (failures.length) {
    const aggregate = new AggregateError(
      [],
      "OperationResult projection synchronization failed",
    );
    aggregate.projections = failures.map(({ projection }) => projection);
    throw aggregate;
  }
}
