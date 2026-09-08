import { plain } from "../shared/valueContract.js";
import { isEmployeeUxActorAllowed } from "../../../utils/auth/policies/employeeActorPolicy.js";

// Client-only UX gating and request normalization. Functions reauthorize and
// validate the latest Employee and its references before archiving.

export const archiveIdentifier = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  value.trim() === value &&
  !/[\/\u0000-\u001f\u007f]/u.test(value);

/** Client display/interaction gate only; Functions authorization is authoritative. */
export const isEmployeeArchiveUxActorAllowed = (identity, actorUser) =>
  isEmployeeUxActorAllowed({ ...identity, actorUser }, false) &&
  (actorUser.isAdmin === true || actorUser.roles.includes("manager"));

export function parseEmployeeArchiveInput(input) {
  const exact =
    plain(input) &&
    Object.keys(input).length === 3 &&
    ["employeeId", "reason", "operationId"].every((key) =>
      Object.hasOwn(input, key));
  if (
    !exact ||
    !archiveIdentifier(input.employeeId) ||
    !archiveIdentifier(input.operationId) ||
    typeof input.reason !== "string"
  ) {
    throw new TypeError("invalid employee archive request");
  }
  const reason = input.reason.trim();
  if (
    !reason.length ||
    reason.length > 200 ||
    /[\u0000-\u001f\u007f]/u.test(reason)
  ) {
    throw new TypeError("invalid employee archive reason");
  }
  return {
    employeeId: input.employeeId,
    operationId: input.operationId,
    reason,
  };
}
