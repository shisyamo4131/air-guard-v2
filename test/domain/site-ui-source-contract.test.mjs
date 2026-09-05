import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const SITE_SFCS = Object.freeze([
  "components/Site/Manager/index.vue",
  "components/Site/Autocomplete.vue",
  "components/Sites/Manager/index.vue",
  "pages/sites/index.vue",
  "pages/sites/[id].vue",
  "pages/sites/terminated.vue",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("SITE-02 Site SFCs parse and compile", async () => {
  for (const path of SITE_SFCS) {
    const url = new URL(`../../${path}`, import.meta.url);
    const content = await readFile(url, "utf8");
    const { descriptor, errors } = parse(content, { filename: url.pathname });
    assert.deepEqual(errors, [], `${path} parse errors`);
    compileScript(descriptor, { id: path.replaceAll(/[^a-z0-9]/giu, "-") });
    const compiled = compileTemplate({
      id: path.replaceAll(/[^a-z0-9]/giu, "-"),
      filename: url.pathname,
      source: descriptor.template.content,
    });
    assert.deepEqual(compiled.errors, [], `${path} template errors`);
  }
});

test("Site managers apply the authorization preflight before every generic write", async () => {
  for (const path of [
    "components/Site/Manager/index.vue",
    "components/Sites/Manager/index.vue",
  ]) {
    const manager = await source(path);
    assert.match(manager, /const \{ canWrite, isSaving, executeSiteWrite, rejectDirectDelete \} =\s*useSiteActions\(\)/u);
    assert.match(manager, /:before-edit="beforeEdit"/u);
    assert.match(manager, /:disable-submit="disableSubmit"/u);
    assert.match(manager, /:disable-update="disableUpdate"/u);
    assert.match(manager, /:handle-create="handleCreate"/u);
    assert.match(manager, /:handle-update="handleUpdate"/u);
    assert.match(manager, /:handle-delete="handleDelete"/u);
    assert.match(
      manager,
      /async function beforeEdit[\s\S]*?editMode === "DELETE"[\s\S]*?rejectDirectDelete\(\)[\s\S]*?executeSiteWrite\(editMode\.toLowerCase\(\)/u,
    );
    assert.match(
      manager,
      /async function handleCreate[\s\S]*?executeSiteWrite\("create", \(\) => props\.handleCreate\(item\)\)/u,
    );
    assert.match(
      manager,
      /async function handleUpdate[\s\S]*?executeSiteWrite\("update", \(\) => props\.handleUpdate\(item\)\)/u,
    );
    assert.match(
      manager,
      /async function handleDelete\(\) \{[\s\S]*?rejectDirectDelete\(\)[\s\S]*?\}/u,
    );
  }
});

test("Site action rebuilds authorization state at send time and refuses direct delete", async () => {
  const actions = await source("composables/application/site/useSiteActions.js");
  assert.match(actions, /authenticationUid: \$auth\?\.currentUser\?\.uid/u);
  assert.match(actions, /isEmailVerified: \$auth\?\.currentUser\?\.emailVerified/u);
  assert.match(
    actions,
    /function assertWritePermission\(\)[\s\S]*?assertSiteWriteAllowed\(authorizationContext\(\)\)/u,
  );
  assert.match(
    actions,
    /const sharedSiteWriteState = Vue\.reactive\(\{ isSaving: false \}\)[\s\S]*?async function executeSiteWrite[\s\S]*?assertWritePermission\(\)[\s\S]*?if \(sharedSiteWriteState\.isSaving\)[\s\S]*?sharedSiteWriteState\.isSaving = true[\s\S]*?return await action\(\)[\s\S]*?finally[\s\S]*?sharedSiteWriteState\.isSaving = false/u,
  );
  assert.match(
    actions,
    /async function rejectDirectDelete[\s\S]*?"operation-not-available"[\s\S]*?"現場は直接削除できません。"/u,
  );
  assert.doesNotMatch(actions, /firebase\/firestore|\.delete\s*\(|Sites_archive/u);
});

test("Site action single-flight is shared across distinct composable instances", async () => {
  const actions = await source("composables/application/site/useSiteActions.js");
  const executable = actions.replace(/^import[\s\S]*?;\r?\n/gmu, "");
  const auth = {
    uid: "actor-a",
    companyId: "company-a",
    isSuperUser: false,
    isSuperUserClaimValid: true,
    user: {
      docId: "actor-a",
      companyId: "company-a",
      isTemporary: false,
      disabled: false,
      isAdmin: true,
      roles: [],
    },
  };
  class HarnessAuthorizationError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  globalThis.__siteActionsHarness = {
    Vue: {
      reactive: (value) => value,
      computed: (getter) => ({ get value() { return getter(); } }),
    },
    useAuthStore: () => auth,
    useNuxtApp: () => ({
      $auth: { currentUser: { uid: "actor-a", emailVerified: true } },
    }),
    SITE_WRITE_OPERATION: { CREATE: "create" },
    SiteAuthorizationError: HarnessAuthorizationError,
    assertSiteWriteAllowed: () => undefined,
    getSiteWriteDecision: () => ({ allowed: true, reason: null }),
  };
  const moduleSource = `
    const {
      Vue, useAuthStore, useNuxtApp, SITE_WRITE_OPERATION,
      SiteAuthorizationError, assertSiteWriteAllowed, getSiteWriteDecision
    } = globalThis.__siteActionsHarness;
    ${executable}
  `;

  try {
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}#${Date.now()}`,
    );
    const first = module.useSiteActions();
    const second = module.useSiteActions();
    let releaseFirst;
    const firstPending = new Promise((resolve) => { releaseFirst = resolve; });
    const firstWrite = first.executeSiteWrite("create", () => firstPending);
    await Promise.resolve();

    assert.equal(first.isSaving.value, true);
    assert.equal(second.isSaving.value, true);
    let secondCallbackCalls = 0;
    await assert.rejects(
      () => second.executeSiteWrite("create", () => { secondCallbackCalls += 1; }),
      (error) => error.code === "operation-in-progress",
    );
    assert.equal(secondCallbackCalls, 0);

    releaseFirst("created");
    assert.equal(await firstWrite, "created");
    assert.equal(first.isSaving.value, false);
    assert.equal(second.isSaving.value, false);
    assert.equal(
      await second.executeSiteWrite("create", async () => "second-created"),
      "second-created",
    );
  } finally {
    delete globalThis.__siteActionsHarness;
  }
});

test("Site pages keep reads visible while gating create, edit, terminate, and agreement writes", async () => {
  const [list, detail] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/[id].vue"),
  ]);

  assert.match(list, /const \{ canWrite, isSaving \} = useSiteActions\(\)/u);
  const activeManager = list.match(/<SitesManager[\s\S]*?>/u)?.[0];
  const activeTable = list.match(/<SitesDataTable[\s\S]*?\/>/u)?.[0];
  assert.ok(activeManager);
  assert.ok(activeTable);
  assert.doesNotMatch(activeManager, /:edit-icon=/u);
  assert.match(activeTable, /:edit-icon="canWrite \? 'mdi-pencil' : 'mdi-eye'"/u);
  assert.match(list, /<v-btn[\s\S]*?v-if="canWrite"[\s\S]*?icon="mdi-plus"/u);
  assert.match(list, /v-if="canWrite"[\s\S]*?:disabled="isSaving"[\s\S]*?icon="mdi-plus"/u);
  assert.match(list, /<SitesDataTable/u);

  assert.match(detail, /const \{ canWrite, isSaving, executeSiteWrite \} = useSiteActions\(\)/u);
  assert.match(detail, /v-if="canWrite"[\s\S]*?text="稼働終了"/u);
  assert.doesNotMatch(detail, /v-if="canWrite && !isSaving"/u);
  assert.match(
    detail,
    /const updateAgreements = \(\) =>\s*executeSiteWrite\("agreement", \(\) => doc\.update\(\)\)/u,
  );
  const agreementsManager = detail.match(/<AgreementsManager[\s\S]*?\/>/u)?.[0];
  assert.ok(agreementsManager);
  assert.match(agreementsManager, /v-if="canWrite"/u);
  assert.doesNotMatch(agreementsManager, /v-if="canWrite && !isSaving"/u);
  assert.match(agreementsManager, /:before-edit="\(\) => !isSaving"/u);
  assert.match(agreementsManager, /:disabled="isSaving"/u);
  assert.match(agreementsManager, /:disable-submit="isSaving"/u);
  assert.match(agreementsManager, /:disable-update="isSaving"/u);
  assert.match(agreementsManager, /@submit:complete="updateAgreements"/u);
  assert.doesNotMatch(
    agreementsManager,
    /:handle-(?:create|update|delete)=/u,
  );
  assert.match(detail, /site-read-only[\s\S]*?display: none/u);
});

test("Terminated Site list preserves navigation but disables unauthorized create and edit UI", async () => {
  const terminated = await source("pages/sites/terminated.vue");
  assert.match(terminated, /const \{ canWrite, isSaving \} = useSiteActions\(\)/u);
  const terminatedManager = terminated.match(/<SitesManager[\s\S]*?\/>/u)?.[0];
  assert.ok(terminatedManager);
  assert.doesNotMatch(terminatedManager, /:edit-icon=/u);
  assert.match(
    terminatedManager,
    /editIcon: canWrite \? 'mdi-pencil' : 'mdi-eye'/u,
  );
  assert.match(
    terminated,
    /:handle-click-update="\(item\) => router\.push\(`\/sites\/\$\{item\.docId\}`\)"/u,
  );
  assert.match(terminated, /disableCreate: !canWrite \|\| isSaving/u);
});

test("Site Autocomplete keeps search available while gating its create affordance", async () => {
  const autocomplete = await source("components/Site/Autocomplete.vue");
  assert.match(autocomplete, /const \{ canWrite, isSaving \} = useSiteActions\(\)/u);
  assert.match(autocomplete, /<template v-if="creatable && canWrite" #append>/u);
  assert.match(autocomplete, /<v-icon :disabled="isSaving" @click="toCreate\(\)">mdi-plus<\/v-icon>/u);
  assert.match(autocomplete, /:api="api"/u);
  assert.match(autocomplete, /:fetchItemByKeyApi="getSite"/u);
});
