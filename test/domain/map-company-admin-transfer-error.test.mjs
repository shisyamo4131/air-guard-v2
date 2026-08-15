import assert from "node:assert/strict";
import test from "node:test";

import {
  mapCompanyAdminTransferError,
} from "../../functions/modules/auth/mapCompanyAdminTransferError.js";
import {
  COMPANY_ADMIN_TRANSFER_ERROR_CODES,
  CompanyAdminTransferError,
} from "../../functions/modules/auth/transferCompanyAdmin.js";
import {
  COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES,
  CompanyAdminTransferPolicyError,
} from "../../functions/modules/auth/companyAdminTransferPolicy.js";
import {
  USER_AUTH_COMPANY_POLICY_ERROR_CODES,
  UserAuthCompanyPolicyError,
} from "../../functions/modules/auth/userAuthCompanyPolicy.js";

const INTERNAL_RESPONSE = {
  code: "internal",
  message: "管理者権限の移譲中に予期しないエラーが発生しました。",
};

const PERMISSION_DENIED_RESPONSE = {
  code: "permission-denied",
  message: "この操作を行う権限がありません。",
};

const USER_STATE_UNAVAILABLE_RESPONSE = {
  code: "failed-precondition",
  message: "管理者移譲に必要なユーザー情報を確認できません。",
};

const TARGET_STATE_INVALID_RESPONSE = {
  code: "failed-precondition",
  message: "移譲先ユーザーは管理者権限を受け取れる状態ではありません。",
};

function assertSafeResponse(error, expected) {
  const response = mapCompanyAdminTransferError(error);

  assert.deepEqual(response, expected);
  assert.equal(response.message.includes("admin-a"), false);
  assert.equal(response.message.includes("company-a"), false);
  assert.equal(response.message.includes("synthetic internal detail"), false);
}

const transferErrorCases = [
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.REQUIRED_FIELD_MISSING,
    expected: {
      code: "invalid-argument",
      message: "必要な情報が不足しているか、形式が正しくありません。",
    },
  },
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_USER_NOT_FOUND,
    expected: USER_STATE_UNAVAILABLE_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_USER_NOT_FOUND,
    expected: USER_STATE_UNAVAILABLE_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_AUTH_NOT_ACTIVE,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_NOT_ACTIVE,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code:
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.SOURCE_AUTH_DISABLED_STATE_INVALID,
    expected: USER_STATE_UNAVAILABLE_RESPONSE,
  },
  {
    code:
      COMPANY_ADMIN_TRANSFER_ERROR_CODES.TARGET_AUTH_DISABLED_STATE_INVALID,
    expected: USER_STATE_UNAVAILABLE_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.AUTH_SERVICE_INVALID,
    expected: INTERNAL_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_ERROR_CODES.FIRESTORE_SERVICE_INVALID,
    expected: INTERNAL_RESPONSE,
  },
];

for (const { code, expected } of transferErrorCases) {
  test(`maps company admin transfer error: ${code}`, () => {
    assertSafeResponse(
      new CompanyAdminTransferError(
        code,
        "synthetic internal detail admin-a company-a",
      ),
      expected,
    );
  });
}

const policyErrorCases = [
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_SOURCE_MISMATCH,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.ACTOR_NOT_CURRENT_ADMIN,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ADMIN,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_NOT_ACTIVE,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_TARGET_SAME,
    expected: {
      code: "invalid-argument",
      message: "移譲元と移譲先には別のユーザーを指定してください。",
    },
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.CURRENT_ADMIN_COUNT_INVALID,
    expected: {
      code: "failed-precondition",
      message: "現在の会社管理者を一意に確認できません。",
    },
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_ADMIN_STATE_INVALID,
    expected: {
      code: "failed-precondition",
      message: "現在の会社管理者の状態を確認できません。",
    },
  },
  {
    code:
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.SOURCE_DISABLED_STATE_INVALID,
    expected: {
      code: "failed-precondition",
      message: "現在の会社管理者の状態を確認できません。",
    },
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ADMIN_STATE_INVALID,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code:
      COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_DISABLED_STATE_INVALID,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_ALREADY_ADMIN,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.TARGET_NOT_ACTIVE,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code: COMPANY_ADMIN_TRANSFER_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    expected: INTERNAL_RESPONSE,
  },
];

for (const { code, expected } of policyErrorCases) {
  test(`maps company admin transfer policy error: ${code}`, () => {
    assertSafeResponse(
      new CompanyAdminTransferPolicyError(
        code,
        "synthetic internal detail admin-a company-a",
      ),
      expected,
    );
  });
}

const companyPolicyErrorCases = [
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_COMPANY_MISMATCH,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISMATCH,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_UID_MISMATCH,
    expected: PERMISSION_DENIED_RESPONSE,
  },
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.AUTH_COMPANY_MISSING,
    expected: USER_STATE_UNAVAILABLE_RESPONSE,
  },
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_IS_TEMPORARY,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.USER_TEMPORARY_STATE_INVALID,
    expected: TARGET_STATE_INVALID_RESPONSE,
  },
  {
    code: USER_AUTH_COMPANY_POLICY_ERROR_CODES.REQUIRED_FIELD_MISSING,
    expected: INTERNAL_RESPONSE,
  },
];

for (const { code, expected } of companyPolicyErrorCases) {
  test(`maps User Auth company policy error: ${code}`, () => {
    assertSafeResponse(
      new UserAuthCompanyPolicyError(
        code,
        "synthetic internal detail admin-a company-a",
      ),
      expected,
    );
  });
}

test("maps Auth user-not-found without exposing account existence", () => {
  const error = Object.assign(
    new Error("synthetic internal detail admin-a company-a"),
    { code: "auth/user-not-found" },
  );

  assertSafeResponse(error, USER_STATE_UNAVAILABLE_RESPONSE);
});

test("unknown typed codes fail closed", () => {
  assertSafeResponse(
    new CompanyAdminTransferError(
      "unknown-code",
      "synthetic internal detail admin-a company-a",
    ),
    INTERNAL_RESPONSE,
  );
  assertSafeResponse(
    new CompanyAdminTransferPolicyError(
      "unknown-code",
      "synthetic internal detail admin-a company-a",
    ),
    INTERNAL_RESPONSE,
  );
  assertSafeResponse(
    new UserAuthCompanyPolicyError(
      "unknown-code",
      "synthetic internal detail admin-a company-a",
    ),
    INTERNAL_RESPONSE,
  );
});

test("unknown errors and empty values fail closed", () => {
  assertSafeResponse(
    new Error("synthetic internal detail admin-a company-a"),
    INTERNAL_RESPONSE,
  );
  assertSafeResponse(null, INTERNAL_RESPONSE);
  assertSafeResponse(undefined, INTERNAL_RESPONSE);
});
