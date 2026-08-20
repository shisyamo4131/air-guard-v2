import { evaluateClientTemporaryUserCreation } from "./policies/temporaryUserCreationPolicy.js";

const CREATE_NOT_ALLOWED_MESSAGE =
  "現在の状態では、仮登録ユーザーを作成できません。";

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

  async function createStandaloneTemporaryUser(item) {
    assertAllowed();
    return await requestStandalone({
      email: item?.email,
      displayName: item?.displayName,
      ...includeDefined(item, [
        "roles",
        "tagSize",
        "receiveConfirmedArrangementNotification",
        "receiveArrivedArrangementNotification",
        "receiveLeavedArrangementNotification",
      ]),
    });
  }

  async function createEmployeeLinkedTemporaryUser(item, { employeeId } = {}) {
    assertAllowed();
    return await requestEmployeeLinked({
      employeeId,
      email: item?.email,
      ...includeDefined(item, ["roles"]),
    });
  }

  return {
    evaluate,
    canCreate,
    getCreateControl,
    createStandaloneTemporaryUser,
    createEmployeeLinkedTemporaryUser,
  };
}
