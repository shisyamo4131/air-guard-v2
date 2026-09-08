import { identifier, plain } from "../../../composables/domain/shared/valueContract.js";

const OPERATION_ROLES = Object.freeze(["manager", "controller", "accountant", "human-resource", "labor", "legal"]);
const WRITE_ROLES = Object.freeze(["manager", "controller"]);
const BILLING_WRITE_ROLES = Object.freeze(["manager", "accountant"]);

// UX-only policy: this prevents presenting known-disallowed operations. The
// saveOperation Callable remains the authoritative authentication and authorization boundary.
export function operationUxAllowed(identity, user, { billing = false } = {}) {
  if (!identifier(identity?.uid) || !identifier(identity?.companyId) || typeof identity.isSuperUser !== "boolean" || !plain(user)
      || user.docId !== identity.uid || user.companyId !== identity.companyId || user.disabled !== false
      || user.isTemporary !== false || typeof user.isAdmin !== "boolean") return false;
  if (user.isAdmin) return true;
  const roles = billing ? BILLING_WRITE_ROLES : WRITE_ROLES;
  return identity.isSuperUser === false && Array.isArray(user.roles) && user.roles.length <= OPERATION_ROLES.length
    && user.roles.every((role) => OPERATION_ROLES.includes(role)) && user.roles.some((role) => roles.includes(role));
}
