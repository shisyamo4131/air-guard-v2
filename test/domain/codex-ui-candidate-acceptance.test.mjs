import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertCandidateAcceptanceMatches,
  fingerprintCandidateDirectory,
} from "../../scripts/codex-local-ui-candidate.mjs";

test("candidate fingerprint is stable and changes with contents", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "airguard-ui-candidate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "auth_export"));
  await writeFile(join(root, "firebase-export-metadata.json"), "{}\n");
  await writeFile(join(root, "auth_export", "accounts.json"), "one\n");

  const first = await fingerprintCandidateDirectory(root);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(await fingerprintCandidateDirectory(root), first);

  await writeFile(join(root, "auth_export", "accounts.json"), "two\n");
  assert.notEqual(await fingerprintCandidateDirectory(root), first);
});

test("candidate acceptance rejects changed fingerprint, source, and schema", () => {
  const expected = {
    schemaVersion: 1,
    kind: "air-guard-v2-codex-local-ui-candidate",
    projectId: "demo-air-guard-v2-codex",
    candidateSha256: "a".repeat(64),
    sourceHead: "b".repeat(40),
  };

  assert.deepEqual(assertCandidateAcceptanceMatches(expected, expected), expected);
  assert.throws(
    () =>
      assertCandidateAcceptanceMatches(expected, {
        ...expected,
        candidateSha256: "c".repeat(64),
      }),
    /candidateSha256/,
  );
  assert.throws(
    () =>
      assertCandidateAcceptanceMatches(expected, {
        ...expected,
        sourceHead: "d".repeat(40),
      }),
    /sourceHead/,
  );
  assert.throws(
    () => assertCandidateAcceptanceMatches(expected, { ...expected, extra: true }),
    /schema mismatch/,
  );
});
