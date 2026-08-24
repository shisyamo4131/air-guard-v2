/*****************************************************************************
 * @file ./functions/modules/auth/lifecycle/registeredUserAuthGateway.js
 * @description UWB-07の本登録User物理削除で、対象Auth identityを再照合して
 * disable・deleteするAdmin Authentication gatewayです。
 *****************************************************************************/
import {
  LIFECYCLE_AUTH_DISPOSITIONS,
  LIFECYCLE_DOMAIN_ERROR_CODES,
} from "./lifecycleOperationSchema.js";

export const REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES = Object.freeze({
  DEPENDENCY_INVALID: "dependency-invalid",
  IDENTITY_INVALID: "identity-invalid",
  AUTH_IDENTITY_MISMATCH: "auth-identity-mismatch",
});

export class RegisteredUserAuthGatewayError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "RegisteredUserAuthGatewayError";
    this.code = code;
    this.domainCode = options.domainCode ?? LIFECYCLE_DOMAIN_ERROR_CODES.INTERNAL;
  }
}

function fail(code, message, options = {}) {
  throw new RegisteredUserAuthGatewayError(code, message, options);
}

function normalizeEmail(value) {
  if (typeof value !== "string" || !value.trim()) {
    fail(
      REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.IDENTITY_INVALID,
      "[registeredUserAuthGateway] expected email is invalid",
    );
  }
  return value.trim().toLowerCase();
}

function assertIdentifier(value, label) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    /\s/u.test(value) ||
    value.includes("/")
  ) {
    fail(
      REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.IDENTITY_INVALID,
      `[registeredUserAuthGateway] ${label} is invalid`,
    );
  }
}

function isUserNotFound(error) {
  return error?.code === "auth/user-not-found";
}

function assertTargetAuthIdentity({
  authUser,
  expectedUid,
  expectedEmail,
  companyId,
  requireDisabled = false,
}) {
  const actualEmail =
    typeof authUser?.email === "string"
      ? authUser.email.trim().toLowerCase()
      : null;
  if (
    authUser?.uid !== expectedUid ||
    actualEmail !== expectedEmail ||
    authUser?.emailVerified !== true ||
    authUser?.customClaims?.companyId !== companyId ||
    authUser?.customClaims?.isSuperUser !== false ||
    typeof authUser?.disabled !== "boolean" ||
    (requireDisabled && authUser.disabled !== true)
  ) {
    fail(
      REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
      "[registeredUserAuthGateway] target Auth identity is inconsistent",
      { domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH },
    );
  }
  return authUser;
}

export function createRegisteredUserAuthGateway({
  auth,
  companyId,
  expectedUid,
  expectedEmail,
} = {}) {
  if (
    !auth ||
    typeof auth.getUser !== "function" ||
    typeof auth.updateUser !== "function" ||
    typeof auth.deleteUser !== "function"
  ) {
    fail(
      REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.DEPENDENCY_INVALID,
      "[registeredUserAuthGateway] Auth service is invalid",
    );
  }
  assertIdentifier(companyId, "companyId");
  assertIdentifier(expectedUid, "expectedUid");
  const canonicalEmail = normalizeEmail(expectedEmail);

  const readAndVerify = async ({ requireDisabled = false } = {}) => {
    let authUser;
    try {
      authUser = await auth.getUser(expectedUid);
    } catch (error) {
      if (isUserNotFound(error)) {
        fail(
          REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
          "[registeredUserAuthGateway] target Auth account was not found",
          {
            cause: error,
            domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
          },
        );
      }
      throw error;
    }
    return assertTargetAuthIdentity({
      authUser,
      expectedUid,
      expectedEmail: canonicalEmail,
      companyId,
      requireDisabled,
    });
  };

  return Object.freeze({
    async verifyTarget() {
      return readAndVerify();
    },

    async disableAndVerify({ targetUserUid } = {}) {
      if (targetUserUid !== expectedUid) {
        fail(
          REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
          "[registeredUserAuthGateway] operation target does not match gateway target",
          { domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH },
        );
      }
      const current = await readAndVerify();
      if (!current.disabled) {
        try {
          await auth.updateUser(expectedUid, { disabled: true });
        } catch (error) {
          if (isUserNotFound(error)) {
            fail(
              REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
              "[registeredUserAuthGateway] target Auth disappeared before disable",
              {
                cause: error,
                domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
              },
            );
          }
          throw error;
        }
      }
      await readAndVerify({ requireDisabled: true });
    },

    async revalidateAndDelete({ targetUserUid } = {}) {
      if (targetUserUid !== expectedUid) {
        fail(
          REGISTERED_USER_AUTH_GATEWAY_ERROR_CODES.AUTH_IDENTITY_MISMATCH,
          "[registeredUserAuthGateway] operation target does not match gateway target",
          { domainCode: LIFECYCLE_DOMAIN_ERROR_CODES.AUTH_IDENTITY_MISMATCH },
        );
      }

      let authUser;
      try {
        authUser = await auth.getUser(expectedUid);
      } catch (error) {
        if (isUserNotFound(error)) {
          return LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT;
        }
        throw error;
      }
      assertTargetAuthIdentity({
        authUser,
        expectedUid,
        expectedEmail: canonicalEmail,
        companyId,
        requireDisabled: true,
      });

      try {
        await auth.deleteUser(expectedUid);
        return LIFECYCLE_AUTH_DISPOSITIONS.DELETED;
      } catch (error) {
        if (isUserNotFound(error)) {
          return LIFECYCLE_AUTH_DISPOSITIONS.ALREADY_ABSENT;
        }
        throw error;
      }
    },
  });
}
