import test from "node:test";
import assert from "node:assert/strict";
import { selectDevDeployTargets } from "../../scripts/select-dev-deploy-targets.mjs";

test("documentation and workflow changes do not deploy Firebase services", () => {
  assert.deepEqual(
    selectDevDeployTargets([
      "docs/runbooks/dev-deployment.md",
      "governance/project-rules.md",
      ".github/workflows/dev-deploy.yml",
      "scripts/select-dev-deploy-targets.mjs",
    ]),
    [],
  );
});

test("service files select only their affected Firebase targets", () => {
  assert.deepEqual(
    selectDevDeployTargets([
      "components/AppHeader.vue",
      "functions/index.js",
      "firestore.rules",
      "storage.rules",
    ]),
    ["firestore", "storage", "functions", "hosting"],
  );
});

test("Firebase configuration selects every deploy target in stable order", () => {
  assert.deepEqual(selectDevDeployTargets(["firebase.json"]), [
    "firestore",
    "storage",
    "database",
    "functions",
    "hosting",
  ]);
});
