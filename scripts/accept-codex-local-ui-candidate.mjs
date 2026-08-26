import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCandidateAcceptance,
  recordCandidateAcceptance,
} from "./codex-local-ui-candidate.mjs";
import { verifyCodexLocalUiState } from "./verify-codex-local-ui-state.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--assert-only")) {
  await assertCandidateAcceptance(projectRoot);
  process.stdout.write('{"candidate_acceptance":true}\n');
} else {
  const expectedIdentity = {
    email: process.env.CODEX_UI_SYNTHETIC_EMAIL,
    companyName: process.env.CODEX_UI_SYNTHETIC_COMPANY_NAME,
    companyNameKana: process.env.CODEX_UI_SYNTHETIC_COMPANY_NAME_KANA,
    displayName: process.env.CODEX_UI_SYNTHETIC_DISPLAY_NAME,
  };
  const verification = await verifyCodexLocalUiState(expectedIdentity);
  if (!verification.ok) {
    throw new Error(
      `Dedicated UI candidate verification failed at ${verification.stage}:${verification.code}.`,
    );
  }
  await recordCandidateAcceptance(projectRoot);
  process.stdout.write('{"candidate_accepted":true}\n');
}
