import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import {
  buildCompanyProfileUpdate,
  CompanyProfileUpdateError,
  parseCompanyProfileChanges,
  updateCompanyProfile,
} from "../../functions/modules/company/updateCompanyProfile.js";

const validCompany = Object.freeze({
  companyName: "警備会社",
  companyNameKana: "ケイビガイシャ",
  zipcode: "1000001",
  prefCode: "13",
  city: "千代田区",
  address: "千代田1-1",
  building: null,
  tel: "03-1234-5678",
  fax: null,
  invoiceNumber: null,
});

test("profile input accepts only a non-empty subset of owned fields", () => {
  assert.deepEqual(parseCompanyProfileChanges({ changes: { city: "港区" } }), {
    city: "港区",
  });
  for (const input of [
    {},
    { changes: {} },
    { changes: { bankName: "銀行" } },
    { changes: { city: "港区" }, companyId: "other" },
  ]) {
    assert.throws(() => parseCompanyProfileChanges(input), CompanyProfileUpdateError);
  }
});

test("profile update normalizes and returns only fields that actually changed", () => {
  assert.deepEqual(
    buildCompanyProfileUpdate(validCompany, {
      companyName: " 警備会社 ",
      city: " 港区 ",
    }),
    { city: "港区", location: null, geopoint: null },
  );
  assert.deepEqual(buildCompanyProfileUpdate(validCompany, { tel: "03-1234-5678" }), {});
  assert.deepEqual(
    buildCompanyProfileUpdate(validCompany, { invoiceNumber: "t1234567890123" }),
    { invoiceNumber: "1234567890123" },
  );
  assert.throws(
    () => buildCompanyProfileUpdate(validCompany, { zipcode: "invalid" }),
    CompanyProfileUpdateError,
  );
});

function snapshot(data, exists = true) {
  return { exists, data: () => data };
}

function createFirestore({ actor, company = validCompany }) {
  const calls = [];
  const firestore = {
    doc: (path) => ({ path }),
    runTransaction: async (callback) =>
      callback({
        get: async (ref) =>
          ref.path.includes("/Users/")
            ? snapshot(actor, !!actor)
            : snapshot(company, !!company),
        update: (ref, value) => calls.push({ path: ref.path, value }),
      }),
  };
  return { firestore, calls };
}

const identity = Object.freeze({
  uid: "admin-a",
  companyId: "company-a",
  isSuperUser: false,
});
const admin = Object.freeze({
  companyId: "company-a",
  isTemporary: false,
  disabled: false,
  isAdmin: true,
});

test("Company administrator writes the changed field with server metadata", async () => {
  const { firestore, calls } = createFirestore({ actor: admin });
  const result = await updateCompanyProfile({
    firestore,
    identity,
    input: { changes: { tel: "03-9999-9999" } },
    serverTimestampFactory: () => "SERVER_TIME",
  });

  assert.deepEqual(result, {
    success: true,
    updated: true,
    updatedFields: ["tel"],
  });
  assert.deepEqual(calls, [
    {
      path: "Companies/company-a",
      value: {
        tel: "03-9999-9999",
        updatedAt: "SERVER_TIME",
        uid: "admin-a",
      },
    },
  ]);
});

test("non-admin and super-user actors are rejected before Company write", async () => {
  for (const scenario of [
    { actor: { ...admin, isAdmin: false }, currentIdentity: identity },
    { actor: admin, currentIdentity: { ...identity, isSuperUser: true } },
  ]) {
    const { firestore, calls } = createFirestore({ actor: scenario.actor });
    await assert.rejects(
      () =>
        updateCompanyProfile({
          firestore,
          identity: scenario.currentIdentity,
          input: { changes: { tel: "03-9999-9999" } },
        }),
      CompanyProfileUpdateError,
    );
    assert.deepEqual(calls, []);
  }
});

test("Company basic editor no longer uses AirItemManager and Rules deny profile client writes", async () => {
  const [page, editor, rules, apiIndex] = await Promise.all([
    readFile(new URL("../../pages/settings/company.vue", import.meta.url), "utf8"),
    readFile(new URL("../../components/Company/ProfileEditor.vue", import.meta.url), "utf8"),
    readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../../functions/apis/index.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<CompanyProfileEditor :company="doc">/);
  assert.doesNotMatch(page, /<CompanyManager :doc="doc" label="基本情報">/);
  assert.match(page, /auth\.user\?\.isAdmin === true/);
  assert.match(page, /auth\.isSuperUser === false/);
  assert.match(page, /:editable="canEditProfile"/);
  assert.match(editor, /Company\.profileSchema/);
  assert.match(editor, /最新値を読み直す/);
  assert.match(editor, /自分の入力を優先する/);
  assert.match(rules, /preservesCompanyProfileFields/);
  assert.match(apiIndex, /updateCompanyProfile/);

  const editorUrl = new URL(
    "../../components/Company/ProfileEditor.vue",
    import.meta.url,
  );
  const { descriptor, errors } = parse(editor, { filename: editorUrl.pathname });
  assert.deepEqual(errors, []);
  compileScript(descriptor, { id: "CompanyProfileEditor" });
  const template = compileTemplate({
    id: "CompanyProfileEditor",
    filename: editorUrl.pathname,
    source: descriptor.template.content,
  });
  assert.deepEqual(template.errors, []);

  const pageUrl = new URL("../../pages/settings/company.vue", import.meta.url);
  const pageSfc = parse(page, { filename: pageUrl.pathname });
  assert.deepEqual(pageSfc.errors, []);
  compileScript(pageSfc.descriptor, { id: "CompanySettingsPage" });
  const pageTemplate = compileTemplate({
    id: "CompanySettingsPage",
    filename: pageUrl.pathname,
    source: pageSfc.descriptor.template.content,
  });
  assert.deepEqual(pageTemplate.errors, []);
});
