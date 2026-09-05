import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const SITE_SFCS = Object.freeze([
  "components/Site/Manager/index.vue",
  "components/Site/Autocomplete.vue",
  "components/Site/CreateDialog.vue",
  "components/Site/Editor/Agreements.vue",
  "components/Site/Editor/Base.vue",
  "components/Site/Editor/Customer.vue",
  "components/Sites/Manager/index.vue",
  "pages/sites/index.vue",
  "pages/sites/[id].vue",
  "pages/sites/terminated.vue",
]);

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

async function vueFiles(directory) {
  const entries = await readdir(new URL(`../../${directory}/`, import.meta.url), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await vueFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".vue")) files.push(path);
  }
  return files;
}

test("Every Vue consumer of useSiteActions has an explicit runtime import", async () => {
  const files = [
    "app.vue",
    ...(await vueFiles("components")),
    ...(await vueFiles("layouts")),
    ...(await vueFiles("pages")),
  ];
  const consumers = [];
  const missingImports = [];
  const explicitImport =
    /import\s*\{[^}]*\buseSiteActions\b[^}]*\}\s*from\s*["']@\/composables\/application\/site\/useSiteActions["']/u;

  for (const path of files) {
    const content = await source(path);
    if (!/\buseSiteActions\s*\(/u.test(content)) continue;
    consumers.push(path);
    if (!explicitImport.test(content)) missingImports.push(path);
  }

  assert.ok(consumers.length > 0, "expected at least one useSiteActions Vue consumer");
  assert.deepEqual(
    missingImports,
    [],
    `useSiteActions consumers without an explicit import:\n${missingImports.join("\n")}`,
  );
});

test("SITE-03 Site SFCs parse and compile", async () => {
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

test("Site routes use operation-specific UI instead of generic whole-document managers", async () => {
  const [list, detail] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/[id].vue"),
  ]);
  assert.match(list, /<SiteCreateDialog/u);
  assert.doesNotMatch(list, /<SitesManager/u);
  assert.match(detail, /<SiteEditorBase/u);
  assert.match(detail, /<SiteEditorCustomer/u);
  assert.match(detail, /<SiteEditorAgreements/u);
  assert.doesNotMatch(detail, /<SiteManager/u);
  assert.doesNotMatch(detail, /\.terminate\s*\(|稼働終了/u);
});

test("Site editors use independent drafts and explicit same-operation conflict checks", async () => {
  const [base, customer, agreements, create] = await Promise.all([
    source("components/Site/Editor/Base.vue"),
    source("components/Site/Editor/Customer.vue"),
    source("components/Site/Editor/Agreements.vue"),
    source("components/Site/CreateDialog.vue"),
  ]);
  assert.match(base, /draft\.value = props\.site\.clone\(\)/u);
  assert.match(base, /baseline\.value = siteSnapshot\(props\.site, operation\)/u);
  assert.match(base, /conflictingSiteFields\([\s\S]*?latest: props\.site[\s\S]*?draft: draft\.value/u);
  assert.match(base, /latest: \(\) => props\.site/u);
  assert.match(base, /if \(isSaving\.value \|\| !canWrite\.value \|\| !draft\.value \|\| refreshConflict\(\)\) return/u);
  assert.doesNotMatch(base, /Object\.assign\(props\.site|v-model="props\.site/u);

  assert.match(customer, /draft\.value = props\.site\.clone\(\)/u);
  assert.match(customer, /baseline\.value = siteSnapshot\(props\.site, operation\)/u);
  assert.match(customer, /latest: \(\) => props\.site/u);
  assert.doesNotMatch(customer, /Object\.assign\(props\.site|v-model="props\.site/u);

  assert.match(agreements, /draft\.value = cloneAgreements\(props\.site\.agreementsV2\)/u);
  assert.match(agreements, /baseline\.value = siteSnapshot\(props\.site, operation\)/u);
  assert.match(agreements, /latest: \(\) => props\.site/u);
  assert.match(agreements, /baseline: baseline\.value/u);
  assert.match(agreements, /conflictingSiteFields\([\s\S]*?latest: props\.site/u);
  assert.match(agreements, /const hasConflict = ref\(false\)/u);
  assert.match(agreements, /function reloadLatest\(\)[\s\S]*?draftRevision\.value \+= 1/u);
  assert.match(agreements, /getSiteOperationErrorMessage\([\s\S]*?取極めを保存できませんでした/u);
  assert.match(agreements, /現在の入力は保持されています/u);
  assert.match(agreements, /最新値を読み直す/u);
  assert.match(agreements, /siteAgreementsHaveZeroPrice\(nextAgreements\)/u);
  assert.match(agreements, /zeroPriceDialog\.value = true/u);
  assert.match(agreements, /0円は有効な単価です/u);
  assert.match(agreements, /今後新しく作成される実績/u);
  assert.match(agreements, /別の明示的な再適用・訂正操作/u);
  assert.match(agreements, /保存するだけでは、作成済み実績の取極めは変更されません/u);
  assert.match(agreements, /resolveZeroPriceConfirmation !== null[\s\S]*?"operation-in-progress"/u);
  assert.match(agreements, /onBeforeUnmount\(\(\) => finishZeroPriceConfirmation\(false\)\)/u);
  assert.match(agreements, /:disabled="isSaving \|\| zeroPriceDialog"/u);
  assert.match(agreements, /:key="draftRevision"/u);
  assert.match(agreements, /:model-value="draft"/u);
  assert.doesNotMatch(agreements, /v-model="(?:props\.)?site\.agreementsV2/u);

  assert.match(create, /draft\.value = new Site\(\)/u);
  assert.match(create, /await createSite\(draft\.value\)/u);
  assert.doesNotMatch(create, /\.create\s*\(|\.update\s*\(/u);
});

test("Site Agreement UI sends exact baseline and candidate transport through the public Callable", async () => {
  const [actions, functions, apiIndex, moduleIndex] = await Promise.all([
    source("composables/application/site/useSiteActions.js"),
    source("composables/site/useSiteFunctions.js"),
    source("functions/apis/index.js"),
    source("functions/modules/sites/index.js"),
  ]);
  assert.match(actions, /createSiteAgreementUpdateRequest\(\{[\s\S]*?siteId: source\.docId,[\s\S]*?baselineAgreements: baseline\?\.agreementsV2,[\s\S]*?candidateAgreements: agreements/u);
  assert.match(actions, /await siteFunctions\.updateSiteAgreements\(request\)/u);
  assert.match(actions, /if \(!isSiteAgreementUpdateResult\(response\)\)/u);
  assert.match(functions, /updateSiteAgreements: \(input\) => call\("updateSiteAgreements", input\)/u);
  assert.match(apiIndex, /export \{ updateSiteAgreements \} from "\.\/updateSiteAgreements\.js"/u);
  assert.match(moduleIndex, /export \{[\s\S]*?updateSiteAgreements[\s\S]*?\} from "\.\/updateSiteAgreements\.js"/u);
});

test("Site action rebuilds authorization state at send time and refuses direct delete", async () => {
  const [actions, archive] = await Promise.all([
    source("composables/application/site/useSiteActions.js"),
    source("composables/application/site/useSiteArchiveAction.js"),
  ]);
  assert.match(actions, /authenticationUid: \$auth\?\.currentUser\?\.uid/u);
  assert.match(actions, /isEmailVerified: \$auth\?\.currentUser\?\.emailVerified/u);
  assert.match(
    actions,
    /function assertWritePermission\(\)[\s\S]*?assertSiteWriteAllowed\(authorizationContext\(\)\)/u,
  );
  assert.match(
    actions,
    /const sharedSiteWriteState = Vue\.reactive\(\{ isSaving: false \}\)[\s\S]*?export async function runWithSiteWriteMutex\(action\)[\s\S]*?if \(sharedSiteWriteState\.isSaving\)[\s\S]*?"operation-in-progress"[\s\S]*?sharedSiteWriteState\.isSaving = true[\s\S]*?return await action\(\)[\s\S]*?finally[\s\S]*?sharedSiteWriteState\.isSaving = false/u,
  );
  assert.match(
    actions,
    /async function executeSiteWrite\(operation, action\)[\s\S]*?assertWritePermission\(\)[\s\S]*?return await runWithSiteWriteMutex\(async \(\) => \{[\s\S]*?return await action\(\)/u,
  );
  assert.match(
    archive,
    /import \{ runWithSiteWriteMutex \} from "@\/composables\/application\/site\/useSiteActions";/u,
  );
  assert.match(
    archive,
    /operationState\.run\(OPERATION, siteId, async \(\) => \{[\s\S]*?return await runWithSiteWriteMutex\(async \(\) => \{/u,
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
      $firestore: "FIRESTORE",
    }),
    useSiteFunctions: () => ({ terminateSite: async () => undefined, reactivateSite: async () => undefined }),
    SITE_WRITE_OPERATION: {
      CREATE: "create", UPDATE: "update", CUSTOMER: "customer",
      AGREEMENT: "agreement", TERMINATE: "terminate",
    },
    SiteAuthorizationError: HarnessAuthorizationError,
    assertSiteWriteAllowed: () => undefined,
    changedSiteFields: () => [],
    createSiteWriter: () => ({}),
    getSiteWriteDecision: () => ({ allowed: true, reason: null }),
    prepareSiteCreate: () => undefined,
    SITE_ADDRESS_FIELDS: [],
    SITE_OPERATION: { UPDATE_BASIC: "UPDATE_BASIC", UPDATE_CUSTOMER: "UPDATE_CUSTOMER" },
    Site: class {},
    SiteOperationError: class extends Error {},
  };
  const moduleSource = `
    const {
      Vue, useAuthStore, useNuxtApp, useSiteFunctions, SITE_WRITE_OPERATION,
      SiteAuthorizationError, assertSiteWriteAllowed, changedSiteFields,
      createSiteWriter, getSiteWriteDecision, prepareSiteCreate,
      SITE_ADDRESS_FIELDS, SITE_OPERATION, Site, SiteOperationError
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

test("Site pages keep reads visible while gating create, edit, and agreement writes", async () => {
  const [list, detail] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/[id].vue"),
  ]);

  assert.match(list, /const \{ canWrite, isSaving \} = useSiteActions\(\)/u);
  const activeTable = list.match(/<SitesDataTable[\s\S]*?\/>/u)?.[0];
  assert.ok(activeTable);
  assert.match(activeTable, /:edit-icon="canWrite \? 'mdi-pencil' : 'mdi-eye'"/u);
  assert.match(list, /<SiteCreateDialog[\s\S]*?v-if="canWrite"/u);
  assert.match(list, /<v-btn :disabled="isSaving" icon="mdi-plus" @click="open"/u);
  assert.match(list, /<SitesDataTable/u);

  assert.match(detail, /<SiteEditorBase :site="doc">/u);
  assert.match(detail, /<SiteEditorCustomer :site="doc">/u);
  assert.match(detail, /<SiteEditorAgreements v-if="canWrite && isActive" :site="doc" \/>/u);
  assert.match(detail, /:editable="canWrite && isActive"/u);
  assert.doesNotMatch(detail, /\.terminate\s*\(|稼働終了/u);
  assert.doesNotMatch(detail, /v-model="doc\.agreementsV2"|saveAgreements/u);
});

test("Terminated Site list preserves navigation but disables unauthorized create and edit UI", async () => {
  const terminated = await source("pages/sites/terminated.vue");
  assert.match(terminated, /const \{ canWrite \} = useSiteActions\(\)/u);
  assert.doesNotMatch(terminated, /<SitesManager|<SiteCreateDialog/u);
  const table = terminated.match(/<SitesDataTable[\s\S]*?\/>/u)?.[0];
  assert.ok(table);
  assert.match(table, /:edit-icon="canWrite \? 'mdi-pencil' : 'mdi-eye'"/u);
  assert.match(
    terminated,
    /@click:update="\(item\) => router\.push\(`\/sites\/\$\{item\.docId\}`\)"/u,
  );
});

test("Site Autocomplete keeps search available while gating its create affordance", async () => {
  const autocomplete = await source("components/Site/Autocomplete.vue");
  assert.match(autocomplete, /const \{ canWrite, isSaving \} = useSiteActions\(\)/u);
  assert.match(autocomplete, /<template v-if="creatable && canWrite" #append>/u);
  assert.match(autocomplete, /<SiteCreateDialog @created="onCreateHandler">/u);
  assert.match(autocomplete, /<v-icon :disabled="isSaving" @click="open">mdi-plus<\/v-icon>/u);
  assert.match(autocomplete, /:api="api"/u);
  assert.match(autocomplete, /:fetchItemByKeyApi="getSite"/u);
});
