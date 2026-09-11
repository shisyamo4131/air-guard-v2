import { identifier } from "../../../composables/domain/shared/valueContract.js";

export const EMPLOYEE_UX_ROLES = Object.freeze([
  "manager",
  "controller",
  "accountant",
  "human-resource",
  "labor",
  "legal",
]);

/** 同一tenantの通常Employee画面に入れる本登録Userかを判定する。 */
export function isEmployeeNormalUxActorAllowed({ uid, companyId, actorUser }) {
  return Boolean(
    identifier(uid) &&
      identifier(companyId) &&
      actorUser &&
      actorUser.docId === uid &&
      actorUser.companyId === companyId &&
      actorUser.disabled === false &&
      actorUser.isTemporary === false &&
      Array.isArray(actorUser.roles),
  );
}

/**
 * Client UX gate only. This mutable client state is not a security boundary;
 * Functions must independently authenticate and authorize every operation.
 */
export function isEmployeeUxActorAllowed(
  { uid, companyId, isSuperUser, actorUser },
  write = true,
) {
  if (
    !isEmployeeNormalUxActorAllowed({ uid, companyId, actorUser }) ||
    typeof isSuperUser !== "boolean" ||
    typeof actorUser.isAdmin !== "boolean"
  ) {
    return false;
  }
  if (actorUser.isAdmin) return true;
  return (
    isSuperUser === false &&
    Array.isArray(actorUser.roles) &&
    actorUser.roles.length > 0 &&
    actorUser.roles.every((role) => EMPLOYEE_UX_ROLES.includes(role)) &&
    (!write ||
      actorUser.roles.some((role) => ["manager", "human-resource"].includes(role)))
  );
}
