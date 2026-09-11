import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiDirectory = new URL("../../functions/apis/", import.meta.url);

async function readApiSource(fileName) {
  return readFile(new URL(fileName, apiDirectory), "utf8");
}

test("every established-company Callable enters through the common Auth identity gate", async () => {
  for (const fileName of [
    "archiveCustomer.js",
    "archiveSite.js",
    "changeAdminUser.js",
    "changeUserEnabledState.js",
    "createTemporaryUser.js",
    "deleteTemporaryUser.js",
    "reactivateSite.js",
    "terminateSite.js",
    "updateCompanyBilling.js",
    "updateCompanyOperations.js",
    "updateSiteAgreements.js",
    "updateUserFields.js",
    "authorizeCompanyRebuild.js",
  ]) {
    const source = await readApiSource(fileName);
    assert.match(
      source,
      /resolveCallableAuthIdentity\s*\(/,
      `${fileName} must use the common Auth identity gate`,
    );
  }

  for (const fileName of [
    "rebuildAllHistories.js",
    "rebuildSecurityReportIndexes.js",
  ]) {
    const source = await readApiSource(fileName);
    assert.match(
      source,
      /authorizeCompanyRebuild\s*\(request\)/,
      `${fileName} must use the shared rebuild authorization gate`,
    );
  }
});

test("anonymous and bootstrap Callables keep their lifecycle-specific identity boundaries", async () => {
  for (const fileName of [
    "checkEmailAvailability.js",
    "checkUserPreRegistration.js",
    "createAdminAccount.js",
    "setupUserAccount.js",
  ]) {
    const source = await readApiSource(fileName);
    assert.equal(
      source.includes("resolveCallableAuthIdentity"),
      false,
      `${fileName} must not require an established company identity`,
    );
  }
});
