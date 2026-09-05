import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as Vue from "vue";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import {
  CompanyArrangementUpdateError,
  parseCompanyArrangementInput,
  updateCompanyArrangement,
} from "../../functions/modules/company/updateCompanyArrangement.js";

const SITE_ORDER = Object.freeze([
  Object.freeze({ siteId: "site-a", shiftType: "DAY" }),
  Object.freeze({ siteId: "site-b", shiftType: "NIGHT" }),
]);

const SCHEDULE_ORDER = Object.freeze([
  Object.freeze({ siteId: "site-c", shiftType: "DAY" }),
]);

const validCompany = Object.freeze({
  fixture: "company-arrangement-domain-test",
  companyName: "対象会社",
  siteOrder: SITE_ORDER,
  scheduleOrder: SCHEDULE_ORDER,
});

const identity = Object.freeze({
  uid: "arrangement-admin-a",
  companyId: "company-a",
  isSuperUser: false,
});

const admin = Object.freeze({
  companyId: "company-a",
  isTemporary: false,
  disabled: false,
  isAdmin: true,
  roles: [],
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

async function loadActionsHarness({ auth, company, callable }) {
  const source = await readFile(
    new URL(
      "../../composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js",
      import.meta.url,
    ),
    "utf8",
  );
  globalThis.__arrangementActionsHarness = {
    Vue,
    TYPE: { ARRANGEMENT: "arrangement", SCHEDULE: "schedule" },
    useAuthStore: () => auth,
    useCompanyStore: () => ({ company }),
    useCompanyFunctions: () => ({ updateCompanyArrangement: callable }),
  };
  const runnableSource = `
    const {
      Vue,
      TYPE,
      useAuthStore,
      useCompanyStore,
      useCompanyFunctions
    } = globalThis.__arrangementActionsHarness;
    ${source.replace(/import[\s\S]*?;\s*/gu, "")}
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(runnableSource).toString("base64")}#${Date.now()}-${Math.random()}`
  );
  return {
    module,
    cleanup: () => delete globalThis.__arrangementActionsHarness,
  };
}

async function loadReorderHarness({ sourceOrder, sites, emit }) {
  const source = await readFile(
    new URL(
      "../../components/SiteShiftTypeOrder/ReorderForm/useIndex.js",
      import.meta.url,
    ),
    "utf8",
  );

  class Site {
    static STATUS_ACTIVE = "ACTIVE";

    static STATUS_TERMINATED = "TERMINATED";

    async fetchDoc({ docId }) {
      const data = sites.get(docId);
      if (data instanceof Error) throw data;
      if (!data) return null;
      Object.assign(this, data, { docId });
      return this;
    }
  }

  class SiteOrder {
    constructor(value = {}) {
      Object.assign(this, value);
      this.key = `${this.siteId}_${this.shiftType}`;
    }
  }

  globalThis.__arrangementReorderHarness = {
    Vue,
    Site,
    SiteOrder,
    useFetch: () => ({
      fetchSiteComposable: { pushSite: () => {} },
    }),
  };
  const runnableSource = `
    const { Vue, Site, SiteOrder, useFetch } =
      globalThis.__arrangementReorderHarness;
    ${source.replace(/import[\s\S]*?;\s*/gu, "")}
  `;
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(runnableSource).toString("base64")}#${Date.now()}-${Math.random()}`
  );
  const props = Vue.reactive({
    siteShiftTypeOrder: sourceOrder,
    disabled: false,
    loading: false,
    saveFailed: false,
  });
  const api = module.useIndex(props, emit);
  await api.init();
  return {
    api,
    props,
    cleanup: () => delete globalThis.__arrangementReorderHarness,
  };
}

async function flushWatchers() {
  await Vue.nextTick();
  await Promise.resolve();
  await Vue.nextTick();
}

test("arrangement input accepts only exact {field, order}", () => {
  assert.deepEqual(
    parseCompanyArrangementInput({ field: "siteOrder", order: SITE_ORDER }),
    { field: "siteOrder", order: SITE_ORDER },
  );
  assert.deepEqual(
    parseCompanyArrangementInput({
      field: "scheduleOrder",
      order: SCHEDULE_ORDER,
    }),
    { field: "scheduleOrder", order: SCHEDULE_ORDER },
  );

  for (const input of [
    null,
    [],
    {},
    { field: "siteOrder" },
    { order: [] },
    { field: "siteOrder", order: [], companyId: "company-b" },
    { field: "agreementsV2", order: [] },
    { field: "siteOrder", order: null },
    { field: "siteOrder", order: {} },
    { field: 1, order: [] },
  ]) {
    assert.throws(
      () => parseCompanyArrangementInput(input),
      CompanyArrangementUpdateError,
    );
  }
});

test("arrangement order accepts 2000 exact items and rejects 2001", () => {
  const twoThousand = Array.from({ length: 2000 }, (_, index) => ({
    siteId: `site-${index}`,
    shiftType: index % 2 === 0 ? "DAY" : "NIGHT",
  }));
  assert.equal(
    parseCompanyArrangementInput({
      field: "siteOrder",
      order: twoThousand,
    }).order.length,
    2000,
  );
  assert.throws(
    () =>
      parseCompanyArrangementInput({
        field: "siteOrder",
        order: [...twoThousand, { siteId: "site-2000", shiftType: "DAY" }],
      }),
    CompanyArrangementUpdateError,
  );
});

test("arrangement items enforce exact keys, identifier boundaries, enum, and uniqueness", () => {
  const invalidItems = [
    null,
    [],
    {},
    { siteId: "site-a" },
    { shiftType: "DAY" },
    { siteId: "site-a", shiftType: "DAY", key: "computed" },
    { siteId: "site-a", shiftType: "DAY", extra: true },
    { siteId: "", shiftType: "DAY" },
    { siteId: "a".repeat(129), shiftType: "DAY" },
    { siteId: "site/a", shiftType: "DAY" },
    { siteId: "site\u0000a", shiftType: "DAY" },
    { siteId: "site\na", shiftType: "DAY" },
    { siteId: "site-a", shiftType: "EVENING" },
    { siteId: "site-a", shiftType: "day" },
  ];
  for (const item of invalidItems) {
    assert.throws(
      () =>
        parseCompanyArrangementInput({ field: "siteOrder", order: [item] }),
      CompanyArrangementUpdateError,
    );
  }

  assert.equal(
    parseCompanyArrangementInput({
      field: "siteOrder",
      order: [{ siteId: "a".repeat(128), shiftType: "NIGHT" }],
    }).order[0].siteId.length,
    128,
  );
  assert.throws(
    () =>
      parseCompanyArrangementInput({
        field: "siteOrder",
        order: [
          { siteId: "site-a", shiftType: "DAY" },
          { siteId: "site-a", shiftType: "DAY" },
        ],
      }),
    CompanyArrangementUpdateError,
  );
  assert.doesNotThrow(() =>
    parseCompanyArrangementInput({
      field: "siteOrder",
      order: [
        { siteId: "site-a", shiftType: "DAY" },
        { siteId: "site-a", shiftType: "NIGHT" },
      ],
    }),
  );
});

test("each arrangement field updates alone with trusted metadata", async () => {
  for (const [field, order] of [
    ["siteOrder", [...SITE_ORDER].reverse()],
    ["scheduleOrder", [{ siteId: "site-d", shiftType: "NIGHT" }]],
  ]) {
    const { calls, firestore, reads } = createFirestore();
    const result = await updateCompanyArrangement({
      firestore,
      identity,
      input: { field, order },
      serverTimestampFactory: () => "SERVER_TIME",
    });
    assert.deepEqual(reads, [
      "Companies/company-a/Users/arrangement-admin-a",
      "Companies/company-a",
    ]);
    assert.deepEqual(result, { success: true, updated: true, field });
    assert.deepEqual(calls, [
      {
        path: "Companies/company-a",
        value: {
          [field]: order,
          updatedAt: "SERVER_TIME",
          uid: "arrangement-admin-a",
        },
      },
    ]);
    assert.equal("fixture" in calls[0].value, false);
    assert.equal("companyName" in calls[0].value, false);
    assert.equal(
      (field === "siteOrder" ? "scheduleOrder" : "siteOrder") in
        calls[0].value,
      false,
    );
  }
});

test("same arrangement value is a write-zero no-op", async () => {
  let timestampCalls = 0;
  const { calls, firestore } = createFirestore();
  const result = await updateCompanyArrangement({
    firestore,
    identity,
    input: { field: "siteOrder", order: SITE_ORDER },
    serverTimestampFactory: () => {
      timestampCalls += 1;
      return "SERVER_TIME";
    },
  });
  assert.deepEqual(result, {
    success: true,
    updated: false,
    field: "siteOrder",
  });
  assert.equal(timestampCalls, 0);
  assert.deepEqual(calls, []);
});

test("administrator and matching known presets may update only their owned order", async () => {
  const dualRoleIdentity = { ...identity, isSuperUser: true };
  const allowed = [
    { field: "siteOrder", actor: admin },
    { field: "scheduleOrder", actor: admin },
    { field: "siteOrder", actor: admin, currentIdentity: dualRoleIdentity },
    {
      field: "scheduleOrder",
      actor: admin,
      currentIdentity: dualRoleIdentity,
    },
    {
      field: "siteOrder",
      actor: { ...admin, isAdmin: false, roles: ["legal"] },
    },
    {
      field: "scheduleOrder",
      actor: { ...admin, isAdmin: false, roles: ["controller"] },
    },
  ];
  for (const scenario of allowed) {
    const { calls, firestore } = createFirestore({ actor: scenario.actor });
    await updateCompanyArrangement({
      firestore,
      identity: scenario.currentIdentity ?? identity,
      input: {
        field: scenario.field,
        order: [{ siteId: "site-new", shiftType: "DAY" }],
      },
      serverTimestampFactory: () => "SERVER_TIME",
    });
    assert.equal(calls.length, 1);
  }

  const denied = [
    { actor: { ...admin, isAdmin: false, roles: ["accountant"] } },
    { actor: { ...admin, isAdmin: false, roles: ["sites:write"] } },
    { actor: { ...admin, isAdmin: false, roles: ["custom-role"] } },
    { actor: { ...admin, isTemporary: true } },
    { actor: { ...admin, disabled: true } },
    { actor: { ...admin, companyId: "company-b" } },
    { actor: { ...admin, isTemporary: undefined } },
    { actor: { ...admin, isTemporary: "false" } },
    { actor: { ...admin, disabled: undefined } },
    { actor: { ...admin, disabled: 0 } },
    { actor: null },
    {
      actor: { ...admin, isAdmin: false },
      currentIdentity: dualRoleIdentity,
    },
    {
      actor: { ...admin, isAdmin: false, roles: ["legal"] },
      currentIdentity: dualRoleIdentity,
    },
    {
      field: "scheduleOrder",
      actor: { ...admin, isAdmin: false, roles: ["controller"] },
      currentIdentity: dualRoleIdentity,
    },
    {
      actor: admin,
      currentIdentity: { uid: identity.uid, companyId: identity.companyId },
    },
    {
      actor: admin,
      currentIdentity: { ...identity, isSuperUser: "false" },
    },
    {
      field: "scheduleOrder",
      actor: { ...admin, isAdmin: false, roles: ["legal"] },
    },
  ];
  for (const scenario of denied) {
    const { calls, firestore } = createFirestore({ actor: scenario.actor });
    await assert.rejects(
      () =>
        updateCompanyArrangement({
          firestore,
          identity: scenario.currentIdentity ?? identity,
          input: {
            field: scenario.field ?? "siteOrder",
            order: [{ siteId: "site-new", shiftType: "DAY" }],
          },
        }),
      CompanyArrangementUpdateError,
    );
    assert.deepEqual(calls, []);
  }

  const { calls, firestore } = createFirestore({ company: null });
  await assert.rejects(
    () =>
      updateCompanyArrangement({
        firestore,
        identity,
        input: { field: "siteOrder", order: [] },
      }),
    CompanyArrangementUpdateError,
  );
  assert.deepEqual(calls, []);
});

test("client actions do not mutate live Company and rethrow failures", async () => {
  const company = {
    docId: "company-a",
    siteOrder: SITE_ORDER.map((item) => ({ ...item, key: "computed" })),
    scheduleOrder: SCHEDULE_ORDER.map((item) => ({ ...item })),
  };
  const auth = {
    companyId: "company-a",
    isSuperUser: false,
    isSuperUserClaimValid: true,
    user: { isAdmin: true, isTemporary: false, disabled: false },
    hasPresetPermission: () => false,
  };
  const pending = createDeferred();
  const calls = [];
  const mounted = await loadActionsHarness({
    auth,
    company,
    callable: async (field, order) => {
      calls.push({ field, order });
      return pending.promise;
    },
  });
  try {
    const actions = mounted.module.useSiteShiftTypeOrderActions({
      type: Vue.ref("arrangement"),
    });
    const original = structuredClone(company.siteOrder);
    const saving = actions.update([
      { siteId: "site-b", shiftType: "NIGHT", key: "site-b_NIGHT" },
      { siteId: "site-a", shiftType: "DAY", key: "site-a_DAY" },
    ]);
    assert.equal(actions.isSaving.value, true);
    assert.deepEqual(company.siteOrder, original);
    assert.deepEqual(calls, [
      {
        field: "siteOrder",
        order: [
          { siteId: "site-b", shiftType: "NIGHT" },
          { siteId: "site-a", shiftType: "DAY" },
        ],
      },
    ]);
    await assert.rejects(
      () => actions.update([]),
      /表示順を更新中です/u,
    );

    const failure = new Error("callable rejected arrangement update");
    pending.reject(failure);
    await assert.rejects(saving, (error) => error === failure);
    assert.deepEqual(company.siteOrder, original);
    assert.equal(actions.isSaving.value, false);
    assert.equal(actions.saveFailed.value, true);
  } finally {
    mounted.cleanup();
  }
});

test("client action visibility is field-specific for administrators, presets, and super-users", async () => {
  const scenarios = [
    { type: "arrangement", isAdmin: true, permissions: [], expected: true },
    { type: "schedule", isAdmin: true, permissions: [], expected: true },
    {
      type: "arrangement",
      isAdmin: false,
      permissions: ["sites:write"],
      expected: true,
    },
    {
      type: "schedule",
      isAdmin: false,
      permissions: ["site-operation-schedules:write"],
      expected: true,
    },
    {
      type: "schedule",
      isAdmin: false,
      permissions: ["sites:write"],
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: false,
      permissions: ["site-operation-schedules:write"],
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      isSuperUser: true,
      expected: true,
    },
    {
      type: "schedule",
      isAdmin: true,
      permissions: [],
      isSuperUser: true,
      expected: true,
    },
    {
      type: "arrangement",
      isAdmin: false,
      permissions: ["sites:write"],
      isSuperUser: true,
      expected: false,
    },
    {
      type: "schedule",
      isAdmin: false,
      permissions: ["site-operation-schedules:write"],
      isSuperUser: true,
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      omitIsSuperUser: true,
      isSuperUserClaimValid: false,
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      isSuperUser: false,
      isSuperUserClaimValid: false,
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      isSuperUser: "false",
      isSuperUserClaimValid: false,
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      isTemporary: undefined,
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      disabled: "false",
      expected: false,
    },
    {
      type: "arrangement",
      isAdmin: true,
      permissions: [],
      companyId: "company-b",
      expected: false,
    },
  ];
  for (const scenario of scenarios) {
    const auth = {
      companyId: scenario.companyId ?? "company-a",
      user: {
        isAdmin: scenario.isAdmin,
        isTemporary:
          "isTemporary" in scenario ? scenario.isTemporary : false,
        disabled: "disabled" in scenario ? scenario.disabled : false,
      },
      hasPresetPermission: (permission) =>
        scenario.permissions.includes(permission),
      isSuperUserClaimValid: scenario.isSuperUserClaimValid ?? true,
    };
    if (!scenario.omitIsSuperUser) {
      auth.isSuperUser = scenario.isSuperUser ?? false;
    }
    const mounted = await loadActionsHarness({
      auth,
      company: { docId: "company-a", siteOrder: [], scheduleOrder: [] },
      callable: async () => ({ success: true }),
    });
    try {
      const actions = mounted.module.useSiteShiftTypeOrderActions({
        type: Vue.ref(scenario.type),
      });
      assert.equal(actions.canUpdate.value, scenario.expected);
    } finally {
      mounted.cleanup();
    }
  }
});

test("auth session exposes strict SuperUser claim validity to display-order actions", async () => {
  const authActions = await readFile(
    new URL(
      "../../composables/application/auth/useAuthActions.js",
      import.meta.url,
    ),
    "utf8",
  );
  const authStore = await readFile(
    new URL("../../stores/useAuthStore.js", import.meta.url),
    "utf8",
  );
  const orderActions = await readFile(
    new URL(
      "../../composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js",
      import.meta.url,
    ),
    "utf8",
  );

  const rawClaim = authActions.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*idTokenResult\.claims\?\.isSuperUser\s*;/u,
  );
  if (rawClaim) {
    const rawClaimName = rawClaim[1];
    assert.match(
      authActions,
      new RegExp(
        `auth\\.isSuperUserClaimValid\\s*=\\s*typeof ${rawClaimName} === ["']boolean["']`,
        "u",
      ),
    );
    assert.match(
      authActions,
      new RegExp(`auth\\.isSuperUser\\s*=\\s*!!${rawClaimName}`, "u"),
    );
  } else {
    assert.match(
      authActions,
      /auth\.isSuperUserClaimValid\s*=\s*\n?\s*typeof idTokenResult\.claims\?\.isSuperUser === ["']boolean["']/u,
    );
    assert.match(
      authActions,
      /auth\.isSuperUser\s*=\s*!!idTokenResult\.claims\?\.isSuperUser/u,
    );
  }

  const clearSession = authActions.match(
    /async function clearSession\(\) \{([\s\S]*?)\n  \}/u,
  );
  assert.ok(clearSession, "clearSession source contract must remain visible");
  assert.match(clearSession[1], /auth\.isSuperUserClaimValid\s*=\s*false/u);
  assert.match(
    authStore,
    /const isSuperUserClaimValid\s*=\s*ref\(false\)\s*;/u,
  );
  assert.match(
    authStore,
    /return \{[\s\S]*?\bisSuperUserClaimValid\s*,[\s\S]*?\};/u,
  );
  assert.match(
    orderActions,
    /auth\.isSuperUserClaimValid\s*===\s*true/u,
  );
});

test("schedule manager removes only schedule order through the guarded action", async () => {
  const manager = await readFile(
    new URL(
      "../../components/OperationSchedules/Manager/index.vue",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    manager,
    /const \{ canUpdate, isSaving, saveFailed, update, remove \}\s*=\s*[\s\S]*?useSiteShiftTypeOrderActions\(\{\s*type: ORDER_TYPE\.SCHEDULE/u,
  );
  assert.match(
    manager,
    /async function removeSiteShiftTypeOrder\(orderKey\)\s*\{\s*if \(!canUpdate\.value \|\| isSaving\.value\) return;\s*try\s*\{\s*await remove\(orderKey\);\s*\}\s*catch \(error\)\s*\{\s*siteShiftTypeOrderLogger\.error\(\{ error \}\);\s*\}\s*\}/u,
  );
  assert.match(
    manager,
    /@click:remove-site-order="removeSiteShiftTypeOrder"/u,
  );
  assert.doesNotMatch(manager, /ORDER_TYPE\.ARRANGEMENT/u);

  const company = {
    docId: "company-a",
    siteOrder: SITE_ORDER.map((item) => ({ ...item })),
    scheduleOrder: [
      { siteId: "site-c", shiftType: "DAY" },
      { siteId: "site-d", shiftType: "NIGHT" },
    ],
  };
  const auth = {
    companyId: "company-a",
    isSuperUser: false,
    isSuperUserClaimValid: true,
    user: { isAdmin: true, isTemporary: false, disabled: false },
    hasPresetPermission: () => false,
  };
  const pending = createDeferred();
  const calls = [];
  const mounted = await loadActionsHarness({
    auth,
    company,
    callable: async (field, order) => {
      calls.push({ field, order });
      return pending.promise;
    },
  });
  const original = structuredClone(company);
  try {
    const actions = mounted.module.useSiteShiftTypeOrderActions({
      type: Vue.ref("schedule"),
    });
    const removing = actions.remove("site-c_DAY");
    assert.equal(actions.isSaving.value, true);
    assert.deepEqual(calls, [
      {
        field: "scheduleOrder",
        order: [{ siteId: "site-d", shiftType: "NIGHT" }],
      },
    ]);
    assert.deepEqual(company, original);
    await assert.rejects(
      () => actions.remove("site-c_DAY"),
      /表示順を更新中です/u,
    );
    assert.equal(calls.length, 1);

    const failure = new Error("schedule removal failed");
    pending.reject(failure);
    await assert.rejects(removing, (error) => error === failure);
    assert.equal(actions.saveFailed.value, true);
    assert.equal(actions.isSaving.value, false);
    assert.deepEqual(company, original);
  } finally {
    mounted.cleanup();
  }

  const deniedCalls = [];
  const denied = await loadActionsHarness({
    auth: {
      ...auth,
      user: { ...auth.user, isAdmin: false },
    },
    company,
    callable: async (...args) => deniedCalls.push(args),
  });
  try {
    const actions = denied.module.useSiteShiftTypeOrderActions({
      type: Vue.ref("schedule"),
    });
    await assert.rejects(
      () => actions.remove("site-c_DAY"),
      /表示順を更新する権限がありません/u,
    );
    assert.deepEqual(deniedCalls, []);
    assert.deepEqual(company, original);
  } finally {
    denied.cleanup();
  }
});

test("reorder draft detects real conflict and reloads latest explicitly", async () => {
  const emitted = [];
  const sites = new Map([
    ["site-a", { status: "ACTIVE" }],
    ["site-b", { status: "ACTIVE" }],
  ]);
  const mounted = await loadReorderHarness({
    sourceOrder: SITE_ORDER.map((item) => ({ ...item })),
    sites,
    emit: (event, payload) => emitted.push({ event, payload }),
  });
  try {
    mounted.api.items.value = [...mounted.api.items.value].reverse();
    const dirtyDraft = mounted.api.items.value.map(({ siteId, shiftType }) => ({
      siteId,
      shiftType,
    }));
    mounted.props.siteShiftTypeOrder = [
      { siteId: "site-a", shiftType: "NIGHT" },
      { siteId: "site-b", shiftType: "DAY" },
    ];
    await flushWatchers();
    assert.deepEqual(
      mounted.api.items.value.map(({ siteId, shiftType }) => ({ siteId, shiftType })),
      dirtyDraft,
    );
    assert.equal(mounted.api.hasExternalChanges.value, true);
    await mounted.api.submit();
    assert.deepEqual(emitted, []);

    await mounted.api.reloadLatest();
    assert.equal(mounted.api.hasExternalChanges.value, false);
    assert.deepEqual(
      mounted.api.items.value.map(({ siteId, shiftType }) => ({ siteId, shiftType })),
      mounted.props.siteShiftTypeOrder,
    );
  } finally {
    mounted.cleanup();
  }
});

test("reorder draft ignores own reflection and keeps draft after save failure", async () => {
  const emitted = [];
  let mounted;
  const sites = new Map([
    ["site-a", { status: "ACTIVE" }],
    ["site-b", { status: "ACTIVE" }],
  ]);
  mounted = await loadReorderHarness({
    sourceOrder: SITE_ORDER.map((item) => ({ ...item })),
    sites,
    emit: (event, payload) => {
      emitted.push({ event, payload });
      if (event === "submit") mounted.props.loading = true;
    },
  });
  try {
    mounted.api.items.value = [...mounted.api.items.value].reverse();
    const submitted = mounted.api.items.value.map(({ siteId, shiftType }) => ({
      siteId,
      shiftType,
    }));
    await mounted.api.submit();
    assert.equal(emitted.length, 1);
    assert.equal(mounted.api.controlsDisabled.value, true);

    mounted.props.siteShiftTypeOrder = submitted;
    await flushWatchers();
    assert.equal(mounted.api.hasExternalChanges.value, false);

    mounted.props.loading = false;
    await flushWatchers();
    mounted.api.items.value = [...mounted.api.items.value].reverse();
    const failedDraft = mounted.api.items.value.map(({ siteId, shiftType }) => ({
      siteId,
      shiftType,
    }));
    await mounted.api.submit();
    mounted.props.saveFailed = true;
    mounted.props.loading = false;
    await flushWatchers();
    assert.deepEqual(
      mounted.api.items.value.map(({ siteId, shiftType }) => ({ siteId, shiftType })),
      failedDraft,
    );
    assert.equal(mounted.api.isChanged.value, true);
  } finally {
    mounted.cleanup();
  }
});

test("existing Site references remain regardless of status until explicit save", async () => {
  const emitted = [];
  const sourceOrder = [
    { siteId: "site-active", shiftType: "DAY" },
    { siteId: "site-missing", shiftType: "DAY" },
    { siteId: "site-terminated", shiftType: "NIGHT" },
    { siteId: "site-inactive", shiftType: "DAY" },
    { siteId: "site-deleted", shiftType: "NIGHT" },
  ];
  const mounted = await loadReorderHarness({
    sourceOrder,
    sites: new Map([
      ["site-active", { status: "ACTIVE" }],
      ["site-terminated", { status: "TERMINATED" }],
      ["site-inactive", { status: "SUSPENDED" }],
      ["site-deleted", null],
    ]),
    emit: (event, payload) => emitted.push({ event, payload }),
  });
  try {
    assert.deepEqual(
      mounted.api.items.value.map(({ siteId }) => siteId),
      ["site-active", "site-terminated", "site-inactive"],
    );
    assert.deepEqual(emitted, []);
    assert.equal(mounted.api.isChanged.value, true);
    await mounted.api.submit();
    assert.deepEqual(emitted, [
      {
        event: "submit",
        payload: [
          { siteId: "site-active", shiftType: "DAY" },
          { siteId: "site-terminated", shiftType: "NIGHT" },
          { siteId: "site-inactive", shiftType: "DAY" },
        ],
      },
    ]);
  } finally {
    mounted.cleanup();
  }
});

test("Site fetch failure preserves the independent draft and stops saving", async () => {
  const emitted = [];
  const sites = new Map([
    ["site-a", { status: "ACTIVE" }],
    ["site-b", { status: "ACTIVE" }],
  ]);
  const mounted = await loadReorderHarness({
    sourceOrder: SITE_ORDER.map((item) => ({ ...item })),
    sites,
    emit: (event, payload) => emitted.push({ event, payload }),
  });
  try {
    mounted.api.items.value = [...mounted.api.items.value].reverse();
    const draftBeforeFailure = mounted.api.items.value.map(
      ({ siteId, shiftType }) => ({ siteId, shiftType }),
    );
    sites.set("site-error", new Error("synthetic Site fetch failure"));
    mounted.props.siteShiftTypeOrder = [
      ...SITE_ORDER.map((item) => ({ ...item })),
      { siteId: "site-error", shiftType: "DAY" },
    ];
    await flushWatchers();

    assert.deepEqual(
      mounted.api.items.value.map(({ siteId, shiftType }) => ({
        siteId,
        shiftType,
      })),
      draftBeforeFailure,
    );
    assert.notEqual(mounted.api.resolutionError.value, "");
    assert.equal(mounted.api.controlsDisabled.value, true);
    await mounted.api.submit();
    assert.deepEqual(emitted, []);
  } finally {
    mounted.cleanup();
  }
});

test("Company settings removes default agreements while Site agreements remain", async () => {
  const [companyPage, sitePage, rules, apiIndex] = await Promise.all([
    readFile(new URL("../../pages/settings/company.vue", import.meta.url), "utf8"),
    readFile(new URL("../../pages/sites/[id].vue", import.meta.url), "utf8"),
    readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../../functions/apis/index.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(companyPage, /AgreementsManager/u);
  assert.doesNotMatch(companyPage, /doc\.agreementsV2/u);
  assert.match(sitePage, /<SiteEditorAgreements\s+v-if="canWrite"\s+:site="doc"\s*\/>/u);
  assert.match(sitePage, /<AgreementsViewer\s+:agreements="doc\.agreementsV2"\s*\/>/u);
  assert.doesNotMatch(sitePage, /v-model="doc\.agreementsV2"/u);
  assert.match(
    rules,
    /match \/Companies\/\{companyDocId\} \{[\s\S]*?allow read:[^;]+;[\s\S]*?allow create, update, delete: if false;/u,
  );
  assert.doesNotMatch(rules, /preservesCompanyArrangementFields/u);
  assert.match(apiIndex, /updateCompanyArrangement/u);
});

test("arrangement editing components compile and disable every save interaction", async () => {
  const files = [
    ["../../components/SiteShiftTypeOrder/ReorderForm/index.vue", "ReorderForm"],
    ["../../components/Draggable/SiteShiftTypeOrder/index.vue", "DraggableOrder"],
    ["../../components/Arrangements/Manager/SpeedDial.vue", "SpeedDial"],
    ["../../components/OperationSchedules/Manager/Toolbar.vue", "ScheduleToolbar"],
    ["../../components/OperationSchedules/Manager/index.vue", "ScheduleManager"],
    ["../../components/OperationSchedules/Table/Body/index.vue", "ScheduleBody"],
    ["../../components/OperationSchedules/Table/index.vue", "ScheduleTable"],
  ];
  for (const [relativePath, id] of files) {
    const url = new URL(relativePath, import.meta.url);
    const source = await readFile(url, "utf8");
    const sfc = parse(source, { filename: url.pathname });
    assert.deepEqual(sfc.errors, []);
    compileScript(sfc.descriptor, { id });
    const template = compileTemplate({
      id,
      filename: url.pathname,
      source: sfc.descriptor.template.content,
    });
    assert.deepEqual(template.errors, []);
  }

  const [
    form,
    draggable,
    speedDial,
    scheduleToolbar,
    action,
    arrangementsManager,
    scheduleManager,
    scheduleBody,
  ] =
    await Promise.all([
      readFile(
        new URL(
          "../../components/SiteShiftTypeOrder/ReorderForm/index.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/Draggable/SiteShiftTypeOrder/index.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/Arrangements/Manager/SpeedDial.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/OperationSchedules/Manager/Toolbar.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../composables/application/siteShiftTypeOrder/useSiteShiftTypeOrderActions.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/Arrangements/Manager/useIndex.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/OperationSchedules/Manager/index.vue",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/OperationSchedules/Table/Body/index.vue",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
  assert.match(form, /:disabled="controlsDisabled \|\| hasExternalChanges"/u);
  assert.match(form, /:disabled="isBusy"[\s\S]*?@click="cancel"/u);
  assert.match(form, /:disabled="isBusy"[\s\S]*?@click="reloadLatest"/u);
  assert.match(form, /最新値を読み直す/u);
  assert.match(draggable, /:disabled="props\.disabled"/u);
  assert.match(speedDial, /siteShiftTypeOrderDisabled/u);
  assert.match(scheduleToolbar, /:disabled="props\.sortDisabled"/u);
  assert.match(action, /if \(isSaving\.value\)/u);
  assert.doesNotMatch(action, /companyStore\.company\.(siteOrder|scheduleOrder)\s*=/u);
  assert.doesNotMatch(action, /companyStore\.company\.update\s*\(/u);
  assert.match(arrangementsManager, /siteShiftTypeOrderSaving/u);
  assert.match(arrangementsManager, /siteOrderActions\.isSaving\.value/u);
  assert.match(scheduleManager, /:sort-disabled="isSaving"/u);
  assert.match(scheduleManager, /:persistent="reorderDialog\.isLoading\.value \|\| isSaving"/u);
  assert.match(scheduleBody, /props\.siteShiftTypeOrderSaving \|\| isRemoveDisabled/u);
  assert.match(scheduleBody, /v-if="props\.canEditSiteShiftTypeOrder"/u);
});
