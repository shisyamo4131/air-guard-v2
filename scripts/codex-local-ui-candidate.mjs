import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { readCleanGitIdentity } from "./codex-local-ui-build-identity.mjs";

export const CANDIDATE_ACCEPTANCE_FILE =
  "ui-candidate-acceptance.json";

const ACCEPTANCE_IDENTITY = Object.freeze({
  schemaVersion: 1,
  kind: "air-guard-v2-codex-local-ui-candidate",
  projectId: "demo-air-guard-v2-codex",
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function listFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else if (entry.isFile()) files.push(path);
    else throw new Error("Dedicated UI candidate contains an unsupported entry.");
  }
  return files;
}

export async function fingerprintCandidateDirectory(candidatePath) {
  if (!(await stat(candidatePath)).isDirectory()) {
    throw new Error("Dedicated UI candidate directory is missing.");
  }
  const files = await listFiles(candidatePath);
  files.sort((left, right) => left.localeCompare(right, "en"));
  const records = [];
  for (const file of files) {
    const contents = await readFile(file);
    const name = relative(candidatePath, file).split(sep).join("/");
    records.push(`${name}|${contents.length}|${sha256(contents)}`);
  }
  return sha256(records.join("\n"));
}

function acceptancePaths(projectRoot) {
  const dedicatedRoot = resolve(projectRoot, ".codex-test");
  return {
    candidatePath: resolve(dedicatedRoot, "ui-candidate"),
    receiptPath: resolve(dedicatedRoot, CANDIDATE_ACCEPTANCE_FILE),
  };
}

export async function recordCandidateAcceptance(projectRoot) {
  const { candidatePath, receiptPath } = acceptancePaths(projectRoot);
  await readFile(resolve(candidatePath, "firebase-export-metadata.json"));
  const receipt = {
    ...ACCEPTANCE_IDENTITY,
    candidateSha256: await fingerprintCandidateDirectory(candidatePath),
    sourceHead: readCleanGitIdentity(projectRoot),
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return receipt;
}

export function assertCandidateAcceptanceMatches(expected, receipt) {
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    Object.keys(receipt).length !== Object.keys(expected).length
  ) {
    throw new Error("Dedicated UI candidate acceptance schema mismatch.");
  }
  for (const [name, value] of Object.entries(expected)) {
    if (receipt[name] !== value) {
      throw new Error(`Dedicated UI candidate acceptance mismatch: ${name}.`);
    }
  }
  return expected;
}

export async function assertCandidateAcceptance(projectRoot) {
  const { candidatePath, receiptPath } = acceptancePaths(projectRoot);
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch {
    throw new Error("Dedicated UI candidate acceptance is missing or unreadable.");
  }
  const expected = {
    ...ACCEPTANCE_IDENTITY,
    candidateSha256: await fingerprintCandidateDirectory(candidatePath),
    sourceHead: readCleanGitIdentity(projectRoot),
  };
  return assertCandidateAcceptanceMatches(expected, receipt);
}
