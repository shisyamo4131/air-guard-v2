import { evaluateClientTemporaryUserCreation } from "./policies/temporaryUserCreationPolicy.js";

const CREATE_NOT_ALLOWED_MESSAGE =
  "現在の状態では、仮登録ユーザーを作成できません。";
const ROLE_ASSIGNMENT_NOT_ALLOWED_REASON = "actor-role-assignment-denied";

export class TemporaryUserCreationClientError extends Error {
  constructor(reason) {
    super(CREATE_NOT_ALLOWED_MESSAGE);
    this.name = "TemporaryUserCreationClientError";
    this.code = "temporary-user-creation-not-allowed";
    this.reason = reason;
  }
}

function includeDefined(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source?.[field] !== undefined) result[field] = source[field];
  }
  return result;
}

/** test可能なapplication controllerを生成します。 */
export function createTemporaryUserCreationController({
  getContext,
  requestStandalone,
  requestEmployeeLinked,
}) {
  function evaluate() {
    return evaluateClientTemporaryUserCreation(getContext());
  }

  function canCreate() {
    return evaluate().allowed;
  }

  function canAssignRoles() {
    return evaluate().canAssignRoles === true;
  }

  function getCreateControl() {
    const result = evaluate();
    return { disabled: !result.allowed, reason: result.reason };
  }

  function assertAllowed() {
    const result = evaluate();
    if (!result.allowed) {
      throw new TemporaryUserCreationClientError(result.reason);
    }
  }

  function resolveRoles(item) {
    const roles = item?.roles;
    if (roles === undefined) return undefined;
    if (!canAssignRoles() && Array.isArray(roles) && roles.length === 0) {
      return [];
    }
    if (!canAssignRoles()) {
      throw new TemporaryUserCreationClientError(
        ROLE_ASSIGNMENT_NOT_ALLOWED_REASON,
      );
    }
    return roles;
  }

  async function createStandaloneTemporaryUser(item) {
    assertAllowed();
    const roles = resolveRoles(item);
    return await requestStandalone({
      email: item?.email,
      displayName: item?.displayName,
      ...(roles === undefined ? {} : { roles }),
      ...includeDefined(item, [
        "tagSize",
        "receiveConfirmedArrangementNotification",
        "receiveArrivedArrangementNotification",
        "receiveLeavedArrangementNotification",
      ]),
    });
  }

  async function createEmployeeLinkedTemporaryUser(item, { employeeId } = {}) {
    assertAllowed();
    const roles = resolveRoles(item);
    return await requestEmployeeLinked({
      employeeId,
      email: item?.email,
      ...(roles === undefined ? {} : { roles }),
    });
  }

  return {
    evaluate,
    canCreate,
    canAssignRoles,
    getCreateControl,
    createStandaloneTemporaryUser,
    createEmployeeLinkedTemporaryUser,
  };
}
