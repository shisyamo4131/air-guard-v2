import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import Company from "../../schemas/Company.js";

const repositoryRoot = new URL("../../", import.meta.url);

async function assertMissing(relativePath) {
  await assert.rejects(
    access(new URL(relativePath, repositoryRoot)),
    (error) => error?.code === "ENOENT",
  );
}

test("legacy Stripe application and Functions entrypoints remain removed", async () => {
  await Promise.all([
    assertMissing("pages/settings/checkout.vue"),
    assertMissing("utils/subscription/getCustomerType.js"),
    assertMissing("functions/modules/stripe.js"),
  ]);

  const [pageSettings, companyStore, functionsEntrypoint] = await Promise.all([
    readFile(new URL("utils/pageSettings.js", repositoryRoot), "utf8"),
    readFile(new URL("stores/useCompanyStore.js", repositoryRoot), "utf8"),
    readFile(new URL("functions/index.js", repositoryRoot), "utf8"),
  ]);
  assert.doesNotMatch(pageSettings, /settings\/checkout|\bid:\s*["']checkout["']/u);
  assert.doesNotMatch(companyStore, /getCustomerType|customerType|subscription/u);
  assert.doesNotMatch(functionsEntrypoint, /modules\/stripe/u);
});

test("root and Functions use the corrected exact schema without Stripe dependency", async () => {
  const [rootPackage, functionsPackage] = await Promise.all([
    readFile(new URL("package.json", repositoryRoot), "utf8").then(JSON.parse),
    readFile(new URL("functions/package.json", repositoryRoot), "utf8").then(
      JSON.parse,
    ),
  ]);

  for (const manifest of [rootPackage, functionsPackage]) {
    assert.equal(
      manifest.dependencies["@shisyamo4131/air-guard-v2-schemas"],
      "3.0.0-dev.1",
    );
  }
  assert.equal(Object.hasOwn(functionsPackage.dependencies, "stripe"), false);
  const expectedInstallCommand =
    "npm install --save-exact @shisyamo4131/air-guard-v2-schemas@3.0.0-dev.1 && cd functions && npm install --save-exact @shisyamo4131/air-guard-v2-schemas@3.0.0-dev.1 && cd ..";
  for (const scriptName of ["install:schemas", "install:schemas@dev"]) {
    const command = rootPackage.scripts[scriptName];
    assert.equal(command, expectedInstallCommand);
    assert.doesNotMatch(command, /2\.4\.2-dev\.167|@latest/u);
  }
});

test("Company ignores legacy Stripe fields when reading and serializing", () => {
  const company = new Company({
    companyName: "合成会社",
    companyNameKana: "ゴウセイガイシャ",
    stripeCustomerId: "legacy-customer",
    subscription: { id: "legacy-subscription", employeeLimit: 10 },
  });
  const payload = company.toObject();

  assert.equal(company.companyName, "合成会社");
  assert.equal(Object.hasOwn(company, "stripeCustomerId"), false);
  assert.equal(Object.hasOwn(company, "subscription"), false);
  assert.equal(Object.hasOwn(payload, "stripeCustomerId"), false);
  assert.equal(Object.hasOwn(payload, "subscription"), false);
});
