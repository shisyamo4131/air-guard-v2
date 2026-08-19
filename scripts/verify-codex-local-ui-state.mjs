const PROJECT_ID = "demo-air-guard-v2-codex";
const AUTH_ORIGIN = "http://127.0.0.1:19099";
const FIRESTORE_ORIGIN = "http://127.0.0.1:18080";
const EMULATOR_ADMIN_HEADERS = Object.freeze({
  authorization: "Bearer owner",
});

async function readJson(response, stage) {
  if (!response.ok) {
    const error = new Error("Dedicated Emulator read failed.");
    error.stage = stage;
    error.code = `http-${response.status}`;
    throw error;
  }
  return response.json();
}

function fieldValue(field) {
  if (!field || typeof field !== "object") return undefined;
  for (const key of ["stringValue", "booleanValue", "integerValue"]) {
    if (key in field) return field[key];
  }
  return undefined;
}

export function isValidFirestorePathSegment(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= 1500
  );
}

export function isValidCompanyNameKana(value) {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    value.trim().length > 0 &&
    /^[\u30A0-\u30FF\u3000 ]+$/u.test(value)
  );
}

async function readOnlyAuthUsers() {
  const response = await fetch(
    `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`,
    {
      method: "POST",
      headers: {
        ...EMULATOR_ADMIN_HEADERS,
        "content-type": "application/json",
      },
      body: JSON.stringify({ maxResults: 2 }),
    },
  );
  const result = await readJson(response, "auth-list");
  return {
    users: result.userInfo ?? [],
    hasMore: Boolean(result.nextPageToken),
  };
}

async function verifyCodexLocalUiStateOrThrow({
  email,
  companyName,
  companyNameKana,
  displayName,
}) {
  if (
    typeof email !== "string" ||
    !/^[^@]+@codex-test\.invalid$/.test(email) ||
    typeof companyName !== "string" ||
    !companyName ||
    !isValidCompanyNameKana(companyNameKana) ||
    typeof displayName !== "string" ||
    !displayName
  ) {
    throw new Error("Expected synthetic UI identity is invalid.");
  }

  const { users, hasMore } = await readOnlyAuthUsers();
  if (users.length !== 1 || hasMore) {
    throw new Error("Expected exactly one synthetic Authentication account.");
  }

  const authUser = users[0];
  const claims = JSON.parse(authUser.customAttributes ?? "{}");
  if (
    authUser.email !== email ||
    authUser.emailVerified !== true ||
    authUser.disabled === true ||
    typeof claims.companyId !== "string" ||
    !isValidFirestorePathSegment(claims.companyId) ||
    !isValidFirestorePathSegment(authUser.localId) ||
    claims.isSuperUser !== false
  ) {
    throw new Error("The regular account lifecycle is incomplete.");
  }

  const documentsOrigin =
    `${FIRESTORE_ORIGIN}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const companyPathSegment = encodeURIComponent(claims.companyId);
  const userPathSegment = encodeURIComponent(authUser.localId);
  const [company, user] = await Promise.all([
    readJson(
      await fetch(`${documentsOrigin}/Companies/${companyPathSegment}`, {
        method: "GET",
        headers: EMULATOR_ADMIN_HEADERS,
      }),
      "company-read",
    ),
    readJson(
      await fetch(
        `${documentsOrigin}/Companies/${companyPathSegment}/Users/${userPathSegment}`,
        {
          method: "GET",
          headers: EMULATOR_ADMIN_HEADERS,
        },
      ),
      "user-read",
    ),
  ]);

  if (
    fieldValue(company.fields?.companyName) !== companyName ||
    fieldValue(company.fields?.companyNameKana) !== companyNameKana ||
    fieldValue(user.fields?.companyId) !== claims.companyId ||
    fieldValue(user.fields?.email) !== email ||
    fieldValue(user.fields?.displayName) !== displayName ||
    fieldValue(user.fields?.isAdmin) !== true ||
    fieldValue(user.fields?.isTemporary) !== false ||
    fieldValue(user.fields?.disabled) !== false
  ) {
    throw new Error("Company or initial administrator User is incomplete.");
  }

  return {
    ok: true,
    authUsers: 1,
    emailVerified: true,
    companyReady: true,
    userReady: true,
    claimsReady: true,
  };
}

export async function verifyCodexLocalUiState(expectedIdentity) {
  try {
    return await verifyCodexLocalUiStateOrThrow(expectedIdentity);
  } catch (error) {
    return {
      ok: false,
      stage: typeof error?.stage === "string" ? error.stage : "verification",
      code: typeof error?.code === "string" ? error.code : "failed",
    };
  }
}
