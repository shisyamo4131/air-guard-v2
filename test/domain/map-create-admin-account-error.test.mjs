import assert from "node:assert/strict";
import test from "node:test";
import { CREATE_ADMIN_ACCOUNT_ERROR_CODES, CreateAdminAccountError } from "../../functions/modules/auth/createAdminAccount.js";
import { INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES, InitialAdminAccountPolicyError } from "../../functions/modules/auth/initialAdminAccountPolicy.js";
import { mapCreateAdminAccountError } from "../../functions/modules/auth/mapCreateAdminAccountError.js";

const SECRET = "uid-secret email-secret@example.com company-secret";
function assertMap(error, code) {
  const result = mapCreateAdminAccountError(error);
  assert.equal(result.code, code);
  assert.equal(result.message.includes("secret"), false);
}

test("policy errors map to stable safe Callable codes", () => {
  for (const [errorCode, callableCode] of [
    ["input-invalid", "invalid-argument"],
    ["auth-identity-invalid", "failed-precondition"],
    ["reservation-invalid", "failed-precondition"],
    ["reservation-conflict", "already-exists"],
    ["existing-state-invalid", "failed-precondition"],
  ]) assertMap(new InitialAdminAccountPolicyError(errorCode, SECRET), callableCode);
});

test("candidate and Firestore contention are retryable", () => {
  assertMap(new CreateAdminAccountError(CREATE_ADMIN_ACCOUNT_ERROR_CODES.CANDIDATE_CONFLICT, SECRET), "aborted");
  for (const code of [10, "10", "aborted"]) assertMap({ code }, "aborted");
});

test("service, forged, and unknown errors stay internal", () => {
  for (const error of [
    new CreateAdminAccountError(CREATE_ADMIN_ACCOUNT_ERROR_CODES.AUTH_SERVICE_INVALID, SECRET),
    new CreateAdminAccountError(CREATE_ADMIN_ACCOUNT_ERROR_CODES.FIRESTORE_SERVICE_INVALID, SECRET),
    new InitialAdminAccountPolicyError("unknown", SECRET),
    { code: "permission-denied", message: SECRET },
    new Error(SECRET),
  ]) assertMap(error, "internal");
});

test("declared policy error catalog is fully classified", () => {
  for (const code of Object.values(INITIAL_ADMIN_ACCOUNT_POLICY_ERROR_CODES)) {
    assert.ok(mapCreateAdminAccountError(new InitialAdminAccountPolicyError(code, SECRET)));
  }
});
