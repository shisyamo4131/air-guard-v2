const PROJECT_ID = "demo-air-guard-v2-codex";
const AUTH_ORIGIN = "http://127.0.0.1:19099";

async function readJson(response, operation) {
  if (!response.ok) {
    throw new Error(`${operation} failed with HTTP ${response.status}.`);
  }
  return response.json();
}

export async function confirmCodexLocalUiEmail(email) {
  if (
    typeof email !== "string" ||
    !/^[^@]+@codex-test\.invalid$/.test(email)
  ) {
    throw new Error("A synthetic Codex UI email is required.");
  }

  const codes = await readJson(
    await fetch(
      `${AUTH_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/oobCodes`,
    ),
    "Reading Auth Emulator verification state",
  );
  const pendingVerifications = (codes.oobCodes ?? []).filter(
    (entry) =>
      entry.requestType === "VERIFY_EMAIL" && entry.email === email,
  );

  if (pendingVerifications.length !== 1) {
    throw new Error(
      `Expected one pending verification for the synthetic UI account, found ${pendingVerifications.length}.`,
    );
  }

  await readJson(
    await fetch(
      `${AUTH_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:update?key=codex-local-only`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oobCode: pendingVerifications[0].oobCode }),
      },
    ),
    "Confirming the synthetic email in Auth Emulator",
  );

  return { confirmed: true };
}
