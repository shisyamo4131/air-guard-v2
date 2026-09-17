import { plain } from "../shared/valueContract.js";
import { isEmployeeNormalUxActorAllowed } from "../../../utils/auth/policies/employeeActorPolicy.js";

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
  isEmployeeNormalUxActorAllowed({ ...identity, actorUser });

export function parseEmployeeArchiveInput(input) {
  const exact =
    plain(input) &&
    Object.keys(input).length === 1 &&
    ["employeeId"].every((key) =>
      Object.hasOwn(input, key));
  if (!exact || !archiveIdentifier(input.employeeId)) {
    throw new TypeError("invalid employee archive request");
  }
  return { employeeId: input.employeeId };
}
