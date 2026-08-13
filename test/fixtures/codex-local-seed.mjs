export const CODEX_LOCAL_PROJECT_ID = "demo-air-guard-v2-codex";

export const CODEX_LOCAL_COMPANIES = Object.freeze({
  primary: Object.freeze({
    id: "codex-company-a",
    name: "Codex架空警備株式会社A",
  }),
  secondary: Object.freeze({
    id: "codex-company-b",
    name: "Codex架空警備株式会社B",
  }),
});

// These credentials exist only inside the ignored Codex Emulator export.
// They are synthetic fixtures, not secrets or accounts for any remote project.
export const CODEX_LOCAL_USERS = Object.freeze([
  Object.freeze({
    email: "operator-a@codex-test.invalid",
    password: "CodexLocalOnly-A-2026!",
    displayName: "Codex Operator A",
    companyId: CODEX_LOCAL_COMPANIES.primary.id,
  }),
  Object.freeze({
    email: "operator-b@codex-test.invalid",
    password: "CodexLocalOnly-B-2026!",
    displayName: "Codex Operator B",
    companyId: CODEX_LOCAL_COMPANIES.secondary.id,
  }),
]);
