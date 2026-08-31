import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { parseUpdateCompanyOperationsInputV1 } from "@shisyamo4131/air-guard-v2-schemas/company-configuration";
import {
  buildCompanyOperationsUpdate,
  COMPANY_OPERATIONS_FIELDS,
  CompanyOperationsUpdateError,
  parseCompanyOperationsChanges,
  updateCompanyOperations,
} from "../../functions/modules/company/updateCompanyOperations.js";

const validCompany = Object.freeze({
  fixture: "company-operations-domain-test",
  minuteInterval: 15,
  roundSetting: "ROUND",
  firstDayOfWeek: 0,
  attendanceManagementMode: "ACTUAL_DATE",
});

const identity = Object.freeze({
  uid: "operations-admin-a",
  companyId: "company-a",
  isSuperUser: false,
});

const admin = Object.freeze({
  companyId: "company-a",
  isTemporary: false,
  disabled: false,
  isAdmin: true,
});

function snapshot(data, exists = true) {
  return { exists, data: () => data };
}

function createFirestore({ actor = admin, company = validCompany } = {}) {
  const calls = [];
  const reads = [];
  const firestore = {
    doc: (path) => ({ path }),
    runTransaction: async (callback) =>
      callback({
        get: async (ref) => {
          reads.push(ref.path);
          return ref.path.includes("/Users/")
            ? snapshot(actor, !!actor)
            : snapshot(company, !!company);
        },
        update: (ref, value) => calls.push({ path: ref.path, value }),
      }),
  };
  return { calls, firestore, reads };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function loadOperationsComposableHarness() {
  const source = await readFile(
    new URL(
      "../../composables/application/company/useCompanyOperationsUpdate.js",
      import.meta.url,
    ),
    "utf8",
  );
  const calls = [];
  const Company = {
    operationsFields: [...COMPANY_OPERATIONS_FIELDS],
    getOperationsValue(source = {}) {
      return Object.fromEntries(
        this.operationsFields.map((field) => [field, source[field] ?? null]),
      );
    },
    normalizeOperations(value) {
      parseUpdateCompanyOperationsInputV1({
        expectedRevision: 1,
        value: {
          minuteInterval: value.minuteInterval,
          roundSetting: value.roundSetting,
          firstDayOfWeek: value.firstDayOfWeek,
          attendanceSummaryMode:
            value.attendanceManagementMode === "ACTUAL_DATE"
              ? "LABOR_STANDARD"
              : value.attendanceManagementMode === "OPERATION_DATE"
                ? "OPERATION_COUNT"
                : value.attendanceManagementMode,
        },
      });
      return value;
    },
  };
  globalThis.__operationsComposableHarness = {
    Company,
    useCompanyFunctions: () => ({
      updateCompanyOperations: async (changes) => {
        calls.push(changes);
        return { success: true, updated: true, updatedFields: Object.keys(changes) };
      },
    }),
  };
  const moduleSource = `${source.replace(/import[\s\S]*?;\s*/gu, "")}
    export { changedOperationsFields };
  `;
  const runnableSource = `
    const { Company, useCompanyFunctions } = globalThis.__operationsComposableHarness;
    ${moduleSource}
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(runnableSource).toString("base64")}#${Date.now()}-${Math.random()}`
  );
  return {
    calls,
    module,
    cleanup: () => delete globalThis.__operationsComposableHarness,
  };
}

async function loadOperationsEditorHarness({ validate, update }) {
  const source = await readFile(
    new URL("../../components/Company/OperationsEditor.vue", import.meta.url),
    "utf8",
  );
  const { descriptor, errors } = parse(source, {
    filename: "OperationsEditor.vue",
  });
  assert.deepEqual(errors, []);
  const company = {
    ...validCompany,
    clone() {
      return { ...this };
    },
  };
  const Company = {
    operationsFields: [...COMPANY_OPERATIONS_FIELDS],
    operationsSchema: [],
    getOperationsValue(source = {}) {
      return Object.fromEntries(
        this.operationsFields.map((field) => [field, source[field] ?? null]),
      );
    },
    normalizeOperations(value) {
      return this.getOperationsValue(value);
    },
  };
  let watcher;
  globalThis.__operationsEditorHarness = {
    Company,
    defineProps: () => ({ company, title: "通常設定の編集" }),
    ref: (value) => ({ value }),
    watch: (_source, callback) => {
      watcher = callback;
    },
    useCompanyOperationsUpdate: () => ({ updateCompanyOperations: update }),
  };
  const setupSource = descriptor.scriptSetup.content.replace(
    /import[\s\S]*?;\s*/gu,
    "",
  );
  const moduleSource = `
    const { Company, defineProps, ref, watch, useCompanyOperationsUpdate } =
      globalThis.__operationsEditorHarness;
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
    triggerLiveWatcher: () => watcher(Company.getOperationsValue(company)),
    cleanup: () => delete globalThis.__operationsEditorHarness,
  };
}

test("operations input is exact {changes} with a non-empty owned-field subset", () => {
  assert.deepEqual(
    parseCompanyOperationsChanges({ changes: { minuteInterval: 20 } }),
    { minuteInterval: 20 },
  );
  for (const input of [
    null,
    [],
    {},
    { changes: null },
    { changes: [] },
    { changes: {} },
    { changes: { bankName: "injected" } },
    { changes: { uid: "forged" } },
    { changes: { updatedAt: "client-time" } },
    { changes: { minuteInterval: 20 }, companyId: "company-b" },
    { changes: { minuteInterval: 20 }, path: "Companies/company-b" },
  ]) {
    assert.throws(
      () => parseCompanyOperationsChanges(input),
      CompanyOperationsUpdateError,
    );
  }
});

test("operations fields enforce exact integer and enum boundaries", () => {
  for (const minuteInterval of [5, 10, 15, 20, 25, 30]) {
    assert.deepEqual(
      buildCompanyOperationsUpdate(validCompany, { minuteInterval }),
      minuteInterval === 15 ? {} : { minuteInterval },
    );
  }
  for (const minuteInterval of [4, 12, 31, 10.5, NaN, Infinity, "15", null]) {
    assert.throws(
      () => buildCompanyOperationsUpdate(validCompany, { minuteInterval }),
      CompanyOperationsUpdateError,
    );
  }

  for (const roundSetting of ["FLOOR", "ROUND", "CEIL"]) {
    assert.deepEqual(
      buildCompanyOperationsUpdate(validCompany, { roundSetting }),
      roundSetting === "ROUND" ? {} : { roundSetting },
    );
  }
  for (const roundSetting of ["floor", "TRUNCATE", "", null, 1]) {
    assert.throws(
      () => buildCompanyOperationsUpdate(validCompany, { roundSetting }),
      CompanyOperationsUpdateError,
    );
  }

  for (let firstDayOfWeek = 0; firstDayOfWeek <= 6; firstDayOfWeek += 1) {
    assert.deepEqual(
      buildCompanyOperationsUpdate(validCompany, { firstDayOfWeek }),
      firstDayOfWeek === 0 ? {} : { firstDayOfWeek },
    );
  }
  for (const firstDayOfWeek of [-1, 7, 1.5, "1", null]) {
    assert.throws(
      () => buildCompanyOperationsUpdate(validCompany, { firstDayOfWeek }),
      CompanyOperationsUpdateError,
    );
  }

  for (const attendanceManagementMode of ["ACTUAL_DATE", "OPERATION_DATE"]) {
    assert.deepEqual(
      buildCompanyOperationsUpdate(validCompany, { attendanceManagementMode }),
      attendanceManagementMode === "ACTUAL_DATE"
        ? {}
        : { attendanceManagementMode },
    );
  }
  for (const attendanceManagementMode of [
    "LABOR_STANDARD",
    "OPERATION_COUNT",
    "UNKNOWN",
    "",
    null,
  ]) {
    assert.throws(
      () =>
        buildCompanyOperationsUpdate(validCompany, {
          attendanceManagementMode,
        }),
      CompanyOperationsUpdateError,
    );
  }
});

test("legacy attendance values round-trip through the canonical parser mapping", () => {
  const canonicalActual = parseUpdateCompanyOperationsInputV1({
    expectedRevision: 1,
    value: {
      minuteInterval: 15,
      roundSetting: "ROUND",
      firstDayOfWeek: 0,
      attendanceSummaryMode: "LABOR_STANDARD",
    },
  }).value;
  assert.equal(canonicalActual.attendanceSummaryMode, "LABOR_STANDARD");
  assert.deepEqual(
    buildCompanyOperationsUpdate(validCompany, {
      attendanceManagementMode: "OPERATION_DATE",
    }),
    { attendanceManagementMode: "OPERATION_DATE" },
  );

  const operationCompany = {
    ...validCompany,
    attendanceManagementMode: "OPERATION_DATE",
  };
  const canonicalOperation = parseUpdateCompanyOperationsInputV1({
    expectedRevision: 1,
    value: {
      minuteInterval: 15,
      roundSetting: "ROUND",
      firstDayOfWeek: 0,
      attendanceSummaryMode: "OPERATION_COUNT",
    },
  }).value;
  assert.equal(canonicalOperation.attendanceSummaryMode, "OPERATION_COUNT");
  assert.deepEqual(
    buildCompanyOperationsUpdate(operationCompany, {
      attendanceManagementMode: "ACTUAL_DATE",
    }),
    { attendanceManagementMode: "ACTUAL_DATE" },
  );
});

test("latest Company candidate writes only normalized changed fields and server metadata", async () => {
  const latestCompany = {
    ...validCompany,
    roundSetting: "CEIL",
    fixture: "latest-company-candidate",
  };
  const { calls, firestore, reads } = createFirestore({ company: latestCompany });
  const result = await updateCompanyOperations({
    firestore,
    identity,
    input: { changes: { minuteInterval: 20, roundSetting: "CEIL" } },
    serverTimestampFactory: () => "SERVER_TIME",
  });

  assert.deepEqual(reads, [
    "Companies/company-a/Users/operations-admin-a",
    "Companies/company-a",
  ]);
  assert.deepEqual(result, {
    success: true,
    updated: true,
    updatedFields: ["minuteInterval"],
  });
  assert.deepEqual(calls, [
    {
      path: "Companies/company-a",
      value: {
        minuteInterval: 20,
        updatedAt: "SERVER_TIME",
        uid: "operations-admin-a",
      },
    },
  ]);
  assert.equal("fixture" in calls[0].value, false);
  assert.equal("attendanceManagementMode" in calls[0].value, false);
});

test("same-value operations input is a write-zero no-op", async () => {
  let timestampCalls = 0;
  const { calls, firestore } = createFirestore();
  const result = await updateCompanyOperations({
    firestore,
    identity,
    input: { changes: { minuteInterval: 15, roundSetting: "ROUND" } },
    serverTimestampFactory: () => {
      timestampCalls += 1;
      return "SERVER_TIME";
    },
  });
  assert.deepEqual(result, { success: true, updated: false, updatedFields: [] });
  assert.equal(timestampCalls, 0);
  assert.deepEqual(calls, []);
});

test("legacy missing attendance mode permits another field update without migration", async () => {
  const legacyCompanies = [
    Object.fromEntries(
      Object.entries(validCompany).filter(
        ([field]) => field !== "attendanceManagementMode",
      ),
    ),
    { ...validCompany, attendanceManagementMode: null },
    { ...validCompany, attendanceManagementMode: "" },
  ];

  for (const company of legacyCompanies) {
    const { calls, firestore } = createFirestore({ company });
    const result = await updateCompanyOperations({
      firestore,
      identity,
      input: { changes: { minuteInterval: 20 } },
      serverTimestampFactory: () => "SERVER_TIME",
    });
    assert.deepEqual(result, {
      success: true,
      updated: true,
      updatedFields: ["minuteInterval"],
    });
    assert.deepEqual(calls, [
      {
        path: "Companies/company-a",
        value: {
          minuteInterval: 20,
          updatedAt: "SERVER_TIME",
          uid: "operations-admin-a",
        },
      },
    ]);
    assert.equal("attendanceManagementMode" in calls[0].value, false);
    assert.equal("attendanceSummaryMode" in calls[0].value, false);
  }

  const { calls, firestore } = createFirestore({
    company: { ...validCompany, attendanceManagementMode: "UNKNOWN" },
  });
  await assert.rejects(
    () =>
      updateCompanyOperations({
        firestore,
        identity,
        input: { changes: { minuteInterval: 20 } },
      }),
    CompanyOperationsUpdateError,
  );
  assert.deepEqual(calls, []);
});

test("disallowed actors and missing resources write nothing", async () => {
  const actorScenarios = [
    null,
    { ...admin, isAdmin: false },
    { ...admin, isTemporary: true },
    { ...admin, disabled: true },
    { ...admin, companyId: "company-b" },
    { companyId: "company-a", disabled: false, isAdmin: true },
    { companyId: "company-a", isTemporary: false, isAdmin: true },
    { ...admin, isTemporary: "false" },
    { ...admin, disabled: 0 },
    { ...admin, isAdmin: 1 },
  ];
  for (const actor of actorScenarios) {
    const { calls, firestore } = createFirestore({ actor });
    await assert.rejects(
      () =>
        updateCompanyOperations({
          firestore,
          identity,
          input: { changes: { minuteInterval: 20 } },
        }),
      CompanyOperationsUpdateError,
    );
    assert.deepEqual(calls, []);
  }

  const { calls: superCalls, firestore: superFirestore } = createFirestore();
  await assert.rejects(
    () =>
      updateCompanyOperations({
        firestore: superFirestore,
        identity: { ...identity, isSuperUser: true },
        input: { changes: { minuteInterval: 20 } },
      }),
    CompanyOperationsUpdateError,
  );
  assert.deepEqual(superCalls, []);

  const { calls: companyCalls, firestore: missingCompany } = createFirestore({
    company: null,
  });
  await assert.rejects(
    () =>
      updateCompanyOperations({
        firestore: missingCompany,
        identity,
        input: { changes: { minuteInterval: 20 } },
      }),
    CompanyOperationsUpdateError,
  );
  assert.deepEqual(companyCalls, []);
});

test("identifier injection is rejected before a transaction write", async () => {
  for (const currentIdentity of [
    { ...identity, companyId: "company-a/other" },
    { ...identity, companyId: " company-a" },
    { ...identity, companyId: "company-a " },
    { ...identity, uid: "admin/a" },
    { ...identity, uid: "" },
  ]) {
    const { calls, firestore } = createFirestore();
    await assert.rejects(
      () =>
        updateCompanyOperations({
          firestore,
          identity: currentIdentity,
          input: { changes: { minuteInterval: 20 } },
        }),
      CompanyOperationsUpdateError,
    );
    assert.deepEqual(calls, []);
  }
});

test("Callable logging and response contract do not expose operations values", async () => {
  const source = await readFile(
    new URL("../../functions/apis/updateCompanyOperations.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /resolveCallableAuthIdentity\s*\(/);
  assert.match(
    source,
    /logger\.error\("Company operations update failed",\s*\{[\s\S]*errorName:[\s\S]*errorCode:/,
  );
  assert.doesNotMatch(source, /logger\.[a-z]+\([^)]*request\.data/s);
  assert.doesNotMatch(
    source,
    /logger\.[a-z]+\([^)]*(minuteInterval|roundSetting|firstDayOfWeek|attendanceManagementMode)/s,
  );

  const { firestore } = createFirestore();
  const result = await updateCompanyOperations({
    firestore,
    identity,
    input: { changes: { roundSetting: "CEIL" } },
    serverTimestampFactory: () => "SERVER_TIME",
  });
  assert.deepEqual(Object.keys(result).sort(), [
    "success",
    "updated",
    "updatedFields",
  ]);
  assert.equal(JSON.stringify(result).includes("CEIL"), false);
});

test("client composable sends changed fields only after validating the latest merge", async () => {
  const mounted = await loadOperationsComposableHarness();
  try {
    const { updateCompanyOperations: update } =
      mounted.module.useCompanyOperationsUpdate();
    const result = await update({
      latest: {
        ...validCompany,
        roundSetting: "CEIL",
      },
      baseline: validCompany,
      draft: {
        ...validCompany,
        minuteInterval: 20,
      },
    });
    assert.deepEqual(mounted.calls, [{ minuteInterval: 20 }]);
    assert.deepEqual(result.updatedFields, ["minuteInterval"]);

    await assert.rejects(() =>
      update({
        latest: { ...validCompany, roundSetting: "BROKEN" },
        baseline: validCompany,
        draft: { ...validCompany, minuteInterval: 25 },
      }),
    );
    assert.deepEqual(mounted.calls, [{ minuteInterval: 20 }]);
  } finally {
    mounted.cleanup();
  }
});

test("client composable skips the Callable for a no-op", async () => {
  const mounted = await loadOperationsComposableHarness();
  try {
    const { updateCompanyOperations: update } =
      mounted.module.useCompanyOperationsUpdate();
    const result = await update({
      latest: validCompany,
      baseline: validCompany,
      draft: { ...validCompany },
    });
    assert.deepEqual(result, {
      success: true,
      updated: false,
      updatedFields: [],
    });
    assert.deepEqual(mounted.calls, []);
  } finally {
    mounted.cleanup();
  }
});

test("OperationsEditor locks submission before async validation and dispatches once", async () => {
  const validation = createDeferred();
  let validationCalls = 0;
  let updateCalls = 0;
  const mounted = await loadOperationsEditorHarness({
    validate: () => {
      validationCalls += 1;
      return validation.promise;
    },
    update: async () => {
      updateCalls += 1;
      return { success: true, updated: true, updatedFields: ["minuteInterval"] };
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

test("OperationsEditor explicitly disables every input and action while saving", async () => {
  const source = await readFile(
    new URL("../../components/Company/OperationsEditor.vue", import.meta.url),
    "utf8",
  );
  assert.match(source, /<v-form[^>]*:disabled="isSaving"/u);
  assert.match(
    source,
    /<air-item-input[\s\S]*?:disabled="isSaving"[\s\S]*?\/>/u,
  );
  assert.match(
    source,
    /<v-btn[\s\S]*?:disabled="isSaving"[\s\S]*?@click="reloadLatest"/u,
  );
  assert.match(
    source,
    /<v-btn :disabled="isSaving" variant="text" @click="close">/u,
  );
  assert.match(source, /:disabled="isSaving \|\| hasExternalChanges"/u);
});

test("OperationsEditor cannot reload latest values during a pending save", async () => {
  const pending = createDeferred();
  const mounted = await loadOperationsEditorHarness({
    validate: async () => ({ valid: true }),
    update: async () => pending.promise,
  });
  try {
    mounted.module.updateProperties({ minuteInterval: 20 });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    mounted.company.roundSetting = "CEIL";
    mounted.triggerLiveWatcher();
    const draftBeforeReload = { ...mounted.module.draft.value };
    const baselineBeforeReload = { ...mounted.module.baseline.value };
    const pendingBeforeReload = { ...mounted.module.pendingOwnSnapshot.value };
    mounted.module.reloadLatest();

    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.deepEqual(mounted.module.draft.value, draftBeforeReload);
    assert.deepEqual(mounted.module.baseline.value, baselineBeforeReload);
    assert.deepEqual(mounted.module.pendingOwnSnapshot.value, pendingBeforeReload);

    pending.reject(new Error("server rejected operations update"));
    await saving;
  } finally {
    mounted.cleanup();
  }
});

test("OperationsEditor rechecks live operations after validation before dispatch", async () => {
  const validation = createDeferred();
  let updateCalls = 0;
  const mounted = await loadOperationsEditorHarness({
    validate: () => validation.promise,
    update: async () => {
      updateCalls += 1;
    },
  });
  try {
    const saving = mounted.module.save();
    mounted.company.firstDayOfWeek = 1;
    mounted.triggerLiveWatcher();
    validation.resolve({ valid: true });
    await saving;
    assert.equal(updateCalls, 0);
    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(mounted.module.dialog.value, true);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("OperationsEditor ignores its pending save reflection and closes after success", async () => {
  const pending = createDeferred();
  let submitted;
  const mounted = await loadOperationsEditorHarness({
    validate: async () => ({ valid: true }),
    update: async (payload) => {
      submitted = payload;
      return pending.promise;
    },
  });
  try {
    mounted.module.updateProperties({ minuteInterval: 20 });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    mounted.company.minuteInterval = 20;
    mounted.triggerLiveWatcher();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(submitted.latest, mounted.company);
    assert.equal(submitted.baseline.minuteInterval, 15);
    assert.equal(submitted.draft.minuteInterval, 20);

    pending.resolve({
      success: true,
      updated: true,
      updatedFields: ["minuteInterval"],
    });
    await saving;
    assert.equal(mounted.module.dialog.value, false);
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("OperationsEditor keeps a real live-change warning after server failure", async () => {
  const pending = createDeferred();
  const mounted = await loadOperationsEditorHarness({
    validate: async () => ({ valid: true }),
    update: async () => pending.promise,
  });
  try {
    mounted.module.updateProperties({ minuteInterval: 20 });
    const saving = mounted.module.save();
    await Promise.resolve();
    await Promise.resolve();
    mounted.company.roundSetting = "FLOOR";
    mounted.triggerLiveWatcher();
    pending.reject(new Error("server rejected operations update"));
    await saving;

    assert.equal(mounted.module.hasExternalChanges.value, true);
    assert.equal(
      mounted.module.errorMessage.value,
      "server rejected operations update",
    );
    assert.equal(mounted.module.dialog.value, true);
    assert.equal(mounted.module.isSaving.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("OperationsEditor preserves reload-only conflict and save payload", async () => {
  const submissions = [];
  const mounted = await loadOperationsEditorHarness({
    validate: async () => ({ valid: true }),
    update: async (payload) => {
      submissions.push(payload);
      return { success: true, updated: true, updatedFields: ["firstDayOfWeek"] };
    },
  });
  try {
    mounted.company.roundSetting = "CEIL";
    mounted.triggerLiveWatcher();
    assert.equal(mounted.module.hasExternalChanges.value, true);
    await mounted.module.save();
    assert.equal(submissions.length, 0);

    mounted.module.reloadLatest();
    assert.equal(mounted.module.hasExternalChanges.value, false);
    assert.equal(mounted.module.draft.value.roundSetting, "CEIL");
    mounted.module.updateProperties({ firstDayOfWeek: 2 });
    await mounted.module.save();

    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].latest, mounted.company);
    assert.equal(submissions[0].baseline.roundSetting, "CEIL");
    assert.equal(submissions[0].draft.firstDayOfWeek, 2);
    assert.equal(mounted.module.dialog.value, false);
  } finally {
    mounted.cleanup();
  }
});

test("operations editor replaces CompanyManager and is admin-only in the page", async () => {
  const [page, editor, activator, rules, apiIndex, schema] = await Promise.all([
    readFile(new URL("../../pages/settings/company.vue", import.meta.url), "utf8"),
    readFile(
      new URL("../../components/Company/OperationsEditor.vue", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../components/Company/Activator/Setting.vue", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../../functions/apis/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../schemas/Company.js", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const canEditOperations = canEditProfile/u);
  assert.match(page, /auth\.user\?\.isAdmin === true/u);
  assert.match(page, /auth\.isSuperUser === false/u);
  assert.match(page, /<CompanyOperationsEditor :company="doc">/u);
  assert.match(page, /:editable="canEditOperations"/u);
  assert.doesNotMatch(page, /<CompanyManager :doc="doc" label="設定情報">/u);
  assert.match(activator, /editable: \{ type: Boolean, default: true \}/u);
  assert.match(activator, /<template v-if="props\.editable" #append>/u);
  assert.match(editor, /Company\.operationsSchema/u);
  assert.match(editor, /現在の入力内容は保存できません/u);
  assert.match(
    rules,
    /match \/Companies\/\{companyDocId\} \{[\s\S]*?allow read:[^;]+;[\s\S]*?allow create, update, delete: if false;/u,
  );
  assert.doesNotMatch(rules, /preservesCompanyOperationsFields/u);
  assert.match(apiIndex, /updateCompanyOperations/u);
  assert.match(schema, /ACTUAL_DATE: "LABOR_STANDARD"/u);
  assert.match(schema, /OPERATION_DATE: "OPERATION_COUNT"/u);

  for (const [filename, source, id] of [
    ["OperationsEditor.vue", editor, "CompanyOperationsEditor"],
    ["Setting.vue", activator, "CompanyActivatorSetting"],
    ["company.vue", page, "CompanySettingsPage"],
  ]) {
    const sfc = parse(source, { filename });
    assert.deepEqual(sfc.errors, []);
    compileScript(sfc.descriptor, { id });
    const template = compileTemplate({
      id,
      filename,
      source: sfc.descriptor.template.content,
    });
    assert.deepEqual(template.errors, []);
  }
});
