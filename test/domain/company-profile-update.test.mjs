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

const PROFILE_FIELDS = Object.freeze(Object.keys(validCompany));

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function loadProfileEditorHarness({ validate, update }) {
  const source = await readFile(
    new URL("../../components/Company/ProfileEditor.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(source, {
    filename: "ProfileEditor.vue",
  });
  assert.deepEqual(errors, []);
  const company = {
    ...validCompany,
    clone() {
      return { ...this };
    },
  };
  const Company = {
    profileFields: [...PROFILE_FIELDS],
    getProfileValue(source = {}) {
      return Object.fromEntries(
        this.profileFields.map((field) => [field, source[field] ?? null]),
      );
    },
    normalizeProfile(value) {
      return value;
    },
  };
  let watcher;
  const harness = {
    Company,
    defineProps: () => ({ company, title: "会社基本情報の編集" }),
    ref: (value) => ({ value }),
    watch: (_source, callback) => {
      watcher = callback;
    },
    useCompanyProfileUpdate: () => ({ updateCompanyProfile: update }),
  };
  globalThis.__profileEditorHarness = harness;
  const setupSource = descriptor.scriptSetup.content.replace(
    /import[\s\S]*?;\s*/gu,
    "",
  );
  const moduleSource = `
    const { Company, defineProps, ref, watch, useCompanyProfileUpdate } =
      globalThis.__profileEditorHarness;
    ${setupSource}
    export {
      baseline,
      dialog,
      draft,
      errorMessage,
      form,
      hasExternalChanges,
      isSaving,
      open,
      pendingOwnSnapshot,
      reloadLatest,
      save,
      updateProperties
    };
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}-${Math.random()}`
  );
  module.form.value = { validate };
  module.open();
  return {
    company,
    module,
    source,
    triggerLiveWatcher: () => watcher(Company.getProfileValue(company)),
    cleanup: () => {
      delete globalThis.__profileEditorHarness;
    },
  };
}

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

test("ProfileEditor locks submission before async validation and dispatches once", async () => {
  const validation = createDeferred();
  let validationCalls = 0;
  let updateCalls = 0;
  const mounted = await loadProfileEditorHarness({
    validate: () => {
      validationCalls += 1;
      return validation.promise;
    },
    update: async () => {
      updateCalls += 1;
      return { success: true, updated: true, updatedFields: ["city"] };
    },
  });
  try {
    const first = mounted.module.save();
    assert.equal(mounted.module.isSaving.value, true);
    assert.equal(validationCalls, 1);
    await mounted.module.save();
    assert.equal(validationCalls, 1);
    validation.resolve({ valid: true });
    await first;
    assert.equal(updateCalls, 1);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("ProfileEditor explicitly disables all editor controls while saving", async () => {
  const source = await readFile(
    new URL("../../components/Company/ProfileEditor.vue", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /<air-item-input[\s\S]*?:disabled="isSaving"[\s\S]*?\/>/u,
  );
  assert.match(
    source,
    /<v-btn[\s\S]*?:disabled="isSaving"[\s\S]*?@click="reloadLatest"/u,
  );
  assert.match(source, /:disabled="isSaving \|\| hasExternalChanges"/u);
});

test("ProfileEditor cannot reload latest values during a pending save", async () => {
  const pending = createDeferred();
  const mounted = await loadProfileEditorHarness({
    validate: async () => ({ valid: true }),
    update: async () => pending.promise,
  });
  try {
    mounted.module.updateProperties({ city: "送信中市" });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    mounted.company.building = "別画面の建物";
    mounted.triggerLiveWatcher();

    const draftBeforeReload = { ...mounted.module.draft.value };
    const baselineBeforeReload = { ...mounted.module.baseline.value };
    const pendingBeforeReload = { ...mounted.module.pendingOwnSnapshot.value };
    mounted.module.reloadLatest();

    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.deepEqual(mounted.module.draft.value, draftBeforeReload);
    assert.deepEqual(mounted.module.baseline.value, baselineBeforeReload);
    assert.deepEqual(mounted.module.pendingOwnSnapshot.value, pendingBeforeReload);

    pending.reject(new Error("server rejected profile update"));
    await saving;
  } finally {
    mounted.cleanup();
  }
});

test("ProfileEditor rechecks live profile after validation before dispatch", async () => {
  const validation = createDeferred();
  let updateCalls = 0;
  const mounted = await loadProfileEditorHarness({
    validate: () => validation.promise,
    update: async () => {
      updateCalls += 1;
    },
  });
  try {
    const saving = mounted.module.save();
    mounted.company.building = "別画面の建物";
    mounted.triggerLiveWatcher();
    validation.resolve({ valid: true });
    await saving;

    assert.equal(updateCalls, 0);
    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(mounted.module.isSaving.value, false);
    assert.equal(mounted.module.dialog.value, true);
  } finally {
    mounted.cleanup();
  }
});

test("ProfileEditor ignores its pending save reflection and closes after success", async () => {
  const pending = createDeferred();
  let updateCalls = 0;
  let submitted;
  const mounted = await loadProfileEditorHarness({
    validate: async () => ({ valid: true }),
    update: async (payload) => {
      updateCalls += 1;
      submitted = payload;
      return pending.promise;
    },
  });
  try {
    mounted.module.updateProperties({ city: "保存反映市" });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(updateCalls, 1);

    mounted.company.city = "保存反映市";
    mounted.triggerLiveWatcher();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(submitted.latest, mounted.company);
    assert.equal(submitted.baseline.city, "千代田区");
    assert.equal(submitted.draft.city, "保存反映市");

    pending.resolve({
      success: true,
      updated: true,
      updatedFields: ["city"],
    });
    await saving;
    assert.equal(mounted.module.dialog.value, false);
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("ProfileEditor keeps a real live-change warning after server failure", async () => {
  const pending = createDeferred();
  const mounted = await loadProfileEditorHarness({
    validate: async () => ({ valid: true }),
    update: async () => pending.promise,
  });
  try {
    mounted.module.updateProperties({ city: "送信中市" });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();

    mounted.company.building = "別actor建物";
    mounted.triggerLiveWatcher();
    pending.reject(new Error("server rejected profile update"));
    await saving;

    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(
      mounted.module.errorMessage.value,
      "server rejected profile update",
    );
    assert.equal(mounted.module.dialog.value, true);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("ProfileEditor preserves reload-only conflict and save payload", async () => {
  const submissions = [];
  const mounted = await loadProfileEditorHarness({
    validate: async () => ({ valid: true }),
    update: async (payload) => {
      submissions.push(payload);
      return { success: true, updated: true, updatedFields: ["city"] };
    },
  });
  try {
    mounted.company.city = "外部確定市";
    mounted.triggerLiveWatcher();
    assert.equal(mounted.module.hasExternalChanges.value, true);
    await mounted.module.save();
    assert.equal(submissions.length, 0);

    mounted.module.reloadLatest();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.draft.value.city, "外部確定市");
    mounted.module.updateProperties({ city: "提出市" });
    await mounted.module.save();

    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].latest, mounted.company);
    assert.equal(submissions[0].baseline.city, "外部確定市");
    assert.equal(submissions[0].draft.city, "提出市");
    assert.equal(mounted.module.dialog.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("Company basic editor no longer uses AirItemManager and Rules deny profile client writes", async () => {
  const [page, editor, activator, rules, apiIndex] = await Promise.all([
    readFile(new URL("../../pages/settings/company.vue", import.meta.url), "utf8"),
    readFile(new URL("../../components/Company/ProfileEditor.vue", import.meta.url), "utf8"),
    readFile(new URL("../../components/Company/Activator/Base.vue", import.meta.url), "utf8"),
    readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../../functions/apis/index.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<CompanyProfileEditor :company="doc">/);
  assert.doesNotMatch(page, /<CompanyManager :doc="doc" label="基本情報">/);
  assert.match(page, /auth\.user\?\.isAdmin === true/);
  assert.match(page, /auth\.isSuperUser === false/);
  assert.match(page, /:editable="canEditProfile"/);
  assert.match(editor, /Company\.profileSchema/);
  assert.match(editor, /<v-dialog[^>]*scrollable>/);
  assert.match(editor, /<v-form[\s\S]*<v-card>[\s\S]*<v-card-text>/);
  assert.match(editor, /現在の入力内容は保存できません/);
  assert.match(editor, /最新値を読み直す/);
  assert.doesNotMatch(editor, /自分の入力を優先する/);
  assert.doesNotMatch(editor, /overwriteConfirmed|confirmOverwrite/);
  assert.match(activator, /title: \{ type: String, default: "基本情報" \}/);
  assert.match(
    rules,
    /match \/Companies\/\{companyDocId\} \{[\s\S]*?allow read:[^;]+;[\s\S]*?allow create, update, delete: if false;/,
  );
  assert.doesNotMatch(rules, /preservesCompanyProfileFields/);
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
