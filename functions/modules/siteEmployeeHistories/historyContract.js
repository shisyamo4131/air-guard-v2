import { plain, identifier, rawForClass } from "../../shared/employeeContract.js";
import { formatJstDate } from "@shisyamo4131/air-guard-v2-schemas/utils";
import { failReference } from "../employees/backgroundReferencePlan.js";

export function historyEmployeeReferences(raw) {
  if (!plain(raw) || !identifier(raw.siteId) || !identifier(raw.employeeId) || raw.docId !== `${raw.siteId}_${raw.employeeId}`) failReference();
  for (const prefix of ["first", "last"]) {
    const date = rawForClass(raw[`${prefix}DateAt`]);
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || raw[`${prefix}Date`] !== formatJstDate(date) || !identifier(raw[`${prefix}OperationResultId`])) failReference();
  }
  return new Set([raw.employeeId]);
}
