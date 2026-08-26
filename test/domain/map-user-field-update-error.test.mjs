import assert from "node:assert/strict";
import test from "node:test";

import {
  USER_FIELD_UPDATE_ERROR_CODES,
  UserFieldUpdateError,
} from "../../functions/modules/auth/updateUserFields.js";
import {
  USER_FIELD_UPDATE_POLICY_ERROR_CODES,
  UserFieldUpdatePolicyError,
} from "../../functions/modules/auth/policies/userFieldUpdatePolicy.js";
import { mapUserFieldUpdateError } from "../../functions/modules/auth/mappers/mapUserFieldUpdateError.js";

test("field update mapper exposes safe expected classifications", () => {
  assert.deepEqual(
    mapUserFieldUpdateError(
      new UserFieldUpdateError(
        USER_FIELD_UPDATE_ERROR_CODES.TARGET_USER_NOT_FOUND,
        "private",
      ),
    ),
    { code: "not-found", message: "対象ユーザーが見つかりません。" },
  );
  assert.deepEqual(
    mapUserFieldUpdateError(
      new UserFieldUpdatePolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.ACTOR_PERMISSION_DENIED,
        "private",
      ),
    ),
    { code: "permission-denied", message: "この操作を行う権限がありません。" },
  );
  assert.deepEqual(
    mapUserFieldUpdateError(
      new UserFieldUpdatePolicyError(
        USER_FIELD_UPDATE_POLICY_ERROR_CODES.SELF_ROLE_CHANGE_FORBIDDEN,
        "private",
      ),
    ),
    { code: "failed-precondition", message: "自分自身の役割を変更することはできません。" },
  );
});

test("unexpected errors map to a generic internal response", () => {
  const response = mapUserFieldUpdateError(new Error("private detail"));
  assert.equal(response.code, "internal");
  assert.equal(response.message.includes("private detail"), false);
});
