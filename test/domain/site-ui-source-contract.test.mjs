import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const SITE_SFCS = Object.freeze([
  "components/Site/Manager/index.vue",
  "components/Site/Autocomplete.vue",
  "components/Site/PostalCodeInput.vue",
  "components/Site/CustomInput/index.vue",
  "components/Site/CustomInput/Base.vue",
  "components/Site/CustomInput/Customer.vue",
  "components/Site/Editor/Agreements.vue",
  "components/Sites/Manager/index.vue",
  "components/Sites/DataTable/index.vue",
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

test("Site routes use common Managers for create and normal updates", async () => {
  const [list, detail] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/[id].vue"),
  ]);
  assert.match(list, /<SitesManager/u);
  assert.doesNotMatch(list, /<SiteCreateDialog/u);
  assert.match(detail, /<SiteManager/u);
  assert.match(detail, /:custom-input="SiteBaseInput"/u);
  assert.match(detail, /:custom-input="SiteCustomerInput"/u);
  assert.match(detail, /<SiteEditorAgreements/u);
  assert.doesNotMatch(detail, /<SiteEditorBase|<SiteEditorCustomer/u);
  assert.doesNotMatch(detail, /\.terminate\s*\(|稼働終了/u);
});

test("Site Managers and inline Agreement use normal Site model saves", async () => {
  const [manager, arrayManager, base, customer, agreements, agreementManager, create] = await Promise.all([
    source("components/Site/Manager/index.vue"),
    source("components/Sites/Manager/index.vue"),
    source("components/Site/CustomInput/Base.vue"),
    source("components/Site/CustomInput/Customer.vue"),
    source("components/Site/Editor/Agreements.vue"),
    source("components/Agreements/Manager/index.vue"),
    source("components/Site/CustomInput/index.vue"),
  ]);
  for (const component of [manager, arrayManager]) {
    assert.match(component, /return await draft\.create\(\)/u);
    assert.match(component, /return await draft\.update\(\)/u);
    assert.match(component, /disable-delete/u);
    assert.match(component, /hide-delete-btn/u);
    assert.doesNotMatch(component, /useSiteActions|createSite|updateSite/u);
  }
  assert.match(manager, /<air-item-manager/u);
  assert.match(manager, /@create="emit\('created', \$event\)"/u);
  assert.match(manager, /@update="emit\('updated', \$event\)"/u);
  assert.match(arrayManager, /<air-array-manager/u);
  assert.match(create, /mode: "step"/u);
  assert.match(create, /steps: 3/u);
  assert.match(create, /searchCustomers\(item\.customerName/u);
  assert.match(create, /<CustomersIterator/u);
  assert.match(create, /取引先未設定で現場を登録/u);
  assert.match(create, /<SitePostalCodeInput/u);
  assert.match(base, /<SitePostalCodeInput/u);
  assert.match(customer, /<CustomerAutocomplete/u);
  for (const input of [create, base]) {
    assert.match(input, /updateProperties/u);
    assert.doesNotMatch(input, /useSiteActions|\.create\s*\(|\.update\s*\(/u);
  }
  assert.match(customer, /componentAttrs/u);
  assert.doesNotMatch(customer, /useSiteActions|\.create\s*\(|\.update\s*\(/u);

  assert.match(agreements, /draft\.value = cloneAgreements\(props\.site\.agreementsV2\)/u);
  assert.match(agreements, /function reloadLatest\(\)[\s\S]*?draftRevision\.value \+= 1/u);
  assert.match(agreements, /const candidate = new Site\(\{[\s\S]*?\.\.\.cloneSiteValue\(props\.site\)[\s\S]*?agreementsV2: cloneAgreements\(nextAgreements\)/u);
  assert.match(agreements, /await candidate\.update\(\)/u);
  assert.match(agreements, /siteAgreementsHaveZeroPrice\(nextAgreements\)/u);
  assert.match(agreements, /zeroPriceDialog\.value = true/u);
  assert.match(agreements, /0円は有効な単価です/u);
  assert.match(agreements, /今後新しく作成される実績/u);
  assert.match(agreements, /別の明示的な再適用・訂正操作/u);
  assert.match(agreements, /保存するだけでは、作成済み実績の取極めは変更されません/u);
  assert.match(agreements, /resolveZeroPriceConfirmation !== null[\s\S]*?"operation-in-progress"/u);
  assert.match(agreements, /onBeforeUnmount\(\(\) => finishZeroPriceConfirmation\(false\)\)/u);
  assert.match(agreements, /v-model:is-editing="isEditing"/u);
  assert.match(agreements, /if \(!isEditing\.value\) reloadLatest\(\)/u);
  assert.match(agreements, /:disabled="managerDisabled"/u);
  assert.match(agreements, /:key="draftRevision"/u);
  assert.match(agreements, /:model-value="draft"/u);
  assert.doesNotMatch(agreements, /取極めを編集|v-model="dialog"/u);
  assert.doesNotMatch(agreements, /useSiteActions|baseline|conflictingSiteFields|updateSiteAgreements/u);
  assert.doesNotMatch(agreements, /v-model="(?:props\.)?site\.agreementsV2/u);
  assert.match(agreementManager, /#table="\{ items, toCreate, toUpdate, disabled \}"/u);
  assert.match(agreementManager, /aria-label="取極めを追加"[\s\S]*?:disabled="disabled"/u);
  assert.match(agreementManager, /aria-label="選択した取極めを編集"[\s\S]*?:disabled="disabled \|\| !currentAgreement"/u);
  assert.match(agreementManager, /aria-label="選択した取極めを複製"[\s\S]*?:disabled="disabled \|\| !currentAgreement"/u);
});

test("Site Agreement Callable transport is removed from the client and Functions entrypoints", async () => {
  const [actions, functions, apiIndex, moduleIndex] = await Promise.all([
    source("composables/application/site/useSiteActions.js"),
    source("composables/site/useSiteFunctions.js"),
    source("functions/apis/index.js"),
    source("functions/modules/sites/index.js"),
  ]);
  for (const sourceText of [actions, functions, apiIndex, moduleIndex]) {
    assert.doesNotMatch(sourceText, /updateSiteAgreements|SiteAgreementUpdate/u);
  }
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
    }),
    useSiteFunctions: () => ({ terminateSite: async () => undefined, reactivateSite: async () => undefined }),
    SITE_WRITE_OPERATION: {
      CREATE: "create", UPDATE: "update", CUSTOMER: "customer",
      TERMINATE: "terminate",
    },
    SiteAuthorizationError: HarnessAuthorizationError,
    assertSiteWriteAllowed: () => undefined,
    getSiteWriteDecision: () => ({ allowed: true, reason: null }),
  };
  const moduleSource = `
    const {
      Vue, useAuthStore, useNuxtApp, useSiteFunctions, SITE_WRITE_OPERATION,
      SiteAuthorizationError, assertSiteWriteAllowed,
      getSiteWriteDecision
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

test("Site pages expose normal Manager writes and keep exceptional operations separate", async () => {
  const [list, detail] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/[id].vue"),
  ]);

  assert.doesNotMatch(list, /useSiteActions/u);
  const activeTable = list.match(/<SitesDataTable[\s\S]*?\/>/u)?.[0];
  assert.ok(activeTable);
  assert.match(activeTable, /edit-icon="mdi-pencil"/u);
  assert.match(list, /<SitesManager/u);
  assert.match(
    list,
    /<v-btn[\s\S]*?icon="mdi-plus"[\s\S]*?@click="\(\) => toCreate\(\)"/u,
  );
  assert.match(list, /<SitesDataTable/u);

  assert.match(detail, /<SiteManager[\s\S]*?:custom-input="SiteBaseInput"/u);
  assert.match(detail, /<SiteManager[\s\S]*?:custom-input="SiteCustomerInput"/u);
  assert.match(detail, /<SiteEditorAgreements v-if="isActive" :site="doc" \/>/u);
  assert.match(detail, /:editable="isActive"/u);
  assert.doesNotMatch(detail, /useSiteActions/u);
  assert.doesNotMatch(detail, /\.terminate\s*\(|稼働終了/u);
  assert.doesNotMatch(detail, /v-model="doc\.agreementsV2"|saveAgreements/u);
});

test("Terminated Site list preserves detail navigation without a normal-write policy wrapper", async () => {
  const terminated = await source("pages/sites/terminated.vue");
  assert.doesNotMatch(terminated, /useSiteActions/u);
  assert.doesNotMatch(terminated, /<SitesManager|<SiteCreateDialog/u);
  const table = terminated.match(/<SitesDataTable[\s\S]*?\/>/u)?.[0];
  assert.ok(table);
  assert.match(table, /edit-icon="mdi-pencil"/u);
  assert.match(
    terminated,
    /@click:update="\(item\) => router\.push\(`\/sites\/\$\{item\.docId\}`\)"/u,
  );
});

test("current Site table consumers expose truthful detail actions and preserve the clicked item", async () => {
  const [active, terminated, table] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/terminated.vue"),
    source("components/Sites/DataTable/index.vue"),
  ]);
  assert.match(table, /aria-label="現場詳細を表示"/u);
  assert.match(table, /title="現場詳細を表示"/u);
  assert.doesNotMatch(table, /現場を編集/u);
  assert.match(table, /@click="emit\('click:update', item\)"/u);
  assert.match(
    table,
    /<air-data-table[\s\S]*?@click:update="emit\('click:update', \$event\)"/u,
  );
  for (const consumer of [active, terminated]) {
    assert.match(consumer, /<SitesDataTable/u);
  }
  assert.match(active, /@click:update="toUpdate"/u);
  assert.match(active, /function handleBeforeEdit[\s\S]*?router\.push\(`\/sites\/\$\{item\.docId\}`\)/u);
  assert.match(terminated, /@click:update="\(item\) => router\.push\(`\/sites\/\$\{item\.docId\}`\)"/u);
});

test("Site Autocomplete uses SiteManager directly for its create affordance", async () => {
  const autocomplete = await source("components/Site/Autocomplete.vue");
  assert.doesNotMatch(autocomplete, /useSiteActions/u);
  assert.match(autocomplete, /<template v-if="creatable" #append>/u);
  assert.match(autocomplete, /<SiteManager label="現場の新規登録" @created="onCreateHandler">/u);
  assert.match(
    autocomplete,
    /<v-btn[\s\S]*?aria-label="現場を新規登録"[\s\S]*?@click="toCreate"/u,
  );
  assert.match(autocomplete, /:api="api"/u);
  assert.match(autocomplete, /:fetch-item-by-key-api="lookupSite"/u);
});

test("SITE-07 list and detail routes expose explicit read states and bounded client paging", async () => {
  const [active, terminated, detail] = await Promise.all([
    source("pages/sites/index.vue"),
    source("pages/sites/terminated.vue"),
    source("pages/sites/[id].vue"),
  ]);

  assert.match(active, /:items-per-page="20"/u);
  assert.match(active, /page[^\n]*=\s*1|currentPage[^\n]*=\s*1/u);
  assert.match(
    active,
    /watch\(\[search, selectedCustomerId, selectedSecurityType\],[\s\S]*?page\.value = 1/u,
  );
  assert.match(terminated, /import\s*\{\s*PAGE_SIZE,\s*useSiteUiReads,?\s*\}/u);
  assert.match(terminated, /:items-per-page="PAGE_SIZE"/u);
  assert.match(terminated, /isLoading/u);
  assert.match(terminated, /errorMessage/u);
  assert.match(terminated, /isEmpty/u);
  assert.match(terminated, /searchTerminatedSites/u);
  assert.match(terminated, /watch\(\s*search,[\s\S]*?page\.value = 1/u);
  assert.match(detail, /lookupSite/u);
  assert.match(detail, /detailResolved/u);
  assert.match(detail, /detailError/u);
  assert.match(detail, /isMissing/u);
  assert.match(
    detail,
    /createSiteDetailReadSession[\s\S]*?request\.isCurrent\(\)[\s\S]*?detailReadSession\.revoke\(\)/u,
  );
  assert.match(detail, /onBeforeUnmount|onUnmounted/u);
  assert.match(detail, /doc\.unsubscribe\(\)/u);
  assert.match(detail, /historyInstance\.unsubscribe\(\)/u);
});

test("terminated Site blank search uses updated freshness with a stable document-id tie-breaker", async () => {
  const reads = await source(
    "composables/dataLayers/site/useSiteUiReads.js",
  );
  assert.match(
    reads,
    /\["where", "status", "==", Site\.STATUS_TERMINATED\],[\s\S]*?\["orderBy", "updatedAt", "desc"\],[\s\S]*?\["orderBy", documentId\(\), "desc"\],[\s\S]*?\["limit", PAGE_SIZE\]/u,
  );
  assert.doesNotMatch(reads, /\["orderBy", "statusChangedAt", "desc"\]/u);
});

test("SITE-07 presentation avoids undefined Customer reads and environment-local dates", async () => {
  const [table, activator, listItem] = await Promise.all([
    source("components/Sites/DataTable/index.vue"),
    source("components/Site/Activator/Base.vue"),
    source("components/Site/ListItem/index.vue"),
  ]);

  assert.match(table, /if \(item\.customerId && !cachedCustomers\[item\.customerId\]\)/u);
  assert.doesNotMatch(table, /fetchCustomer\(undefined\)/u);
  assert.doesNotMatch(table, /\.toLocaleDateString\s*\(/u);
  assert.doesNotMatch(table, /\.\.\.loading/u);
  assert.doesNotMatch(activator, /`\$\{start\} 〜 \$\{end\}`/u);
  for (const renderer of [table, listItem]) {
    assert.match(
      renderer,
      /v-if="!badges(?:Of\(item\)|\.value)?\.some|v-if="!badges\.some/u,
    );
  }

  const list = await source("pages/sites/index.vue");
  assert.match(list, /if \(site\?\.customerId\) fetchCustomer\(site\.customerId\)/u);
});

test("SITE-07 reachable Site controls have accessible button semantics", async () => {
  const [list, autocomplete, table, base, customer] = await Promise.all([
    source("pages/sites/index.vue"),
    source("components/Site/Autocomplete.vue"),
    source("components/Sites/DataTable/index.vue"),
    source("components/Site/Activator/Base.vue"),
    source("components/Site/Activator/Customer.vue"),
  ]);

  assert.match(list, /aria-label="現場を新規登録"/u);
  assert.match(list, /aria-label="現場の絞り込み条件を設定"/u);
  assert.match(list, /aria-label="絞り込み条件を閉じる"/u);
  assert.match(autocomplete, /aria-label="現場を新規登録"/u);
  assert.match(table, /item\.actions/u);
  assert.match(table, /aria-label="現場詳細を表示"/u);
  assert.match(base, /aria-label="現場の基本情報を編集"/u);
  assert.match(customer, /aria-label="現場の取引先情報を編集"/u);
});
