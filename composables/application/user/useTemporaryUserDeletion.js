/*****************************************************************************
 * @file ./composables/application/user/useTemporaryUserDeletion.js
 * @description 仮登録User削除のclient policyとCallable実行を提供します。
 * @method useTemporaryUserDeletion
 *****************************************************************************/
import { evaluateClientTemporaryUserDeletion } from "../../../utils/auth/policies/temporaryUserDeletionPolicy.js";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useAuthFunctions } from "../../auth/useAuthFunctions";

const DELETE_NOT_ALLOWED_MESSAGE =
  "現在の状態では、この仮登録ユーザーを削除できません。";

export class TemporaryUserDeletionClientError extends Error {
  constructor(reason) {
    super(DELETE_NOT_ALLOWED_MESSAGE);

    this.name = "TemporaryUserDeletionClientError";
    this.code = "temporary-user-deletion-not-allowed";
    this.reason = reason;
  }
}

/**
 * client policyを適用し、仮登録User削除操作を提供します。
 * serverの最終認可はCallable側で必ず再実行されます。
 *
 * @returns {{
 *   evaluate: (targetUser: Object, context?: Object) => {allowed: boolean, reason: string|null},
 *   canDelete: (targetUser: Object, context?: Object) => boolean,
 *   getDeleteControl: (targetUser: Object, context?: Object) => {disabled: boolean, reason: string|null},
 *   deleteTemporaryUser: (targetUser: Object, context?: Object) => Promise<Object>,
 * }}
 */
export function useTemporaryUserDeletion() {
  const auth = useAuthStore();
  const { deleteTemporaryUser: requestDeleteTemporaryUser } =
    useAuthFunctions();

  function evaluate(targetUser, context) {
    const employeeId = context?.employeeId;

    return evaluateClientTemporaryUserDeletion({
      companyId: auth.companyId,
      actorUser: auth.user,
      targetUser,
      ...(employeeId === undefined ? {} : { employeeId }),
    });
  }

  function canDelete(targetUser, context) {
    return evaluate(targetUser, context).allowed;
  }

  function getDeleteControl(targetUser, context) {
    const result = evaluate(targetUser, context);

    return {
      disabled: !result.allowed,
      reason: result.reason,
    };
  }

  async function deleteTemporaryUser(targetUser, context) {
    const result = evaluate(targetUser, context);

    if (!result.allowed) {
      throw new TemporaryUserDeletionClientError(result.reason);
    }

    return await requestDeleteTemporaryUser(targetUser.docId);
  }

  return {
    evaluate,
    canDelete,
    getDeleteControl,
    deleteTemporaryUser,
  };
}
