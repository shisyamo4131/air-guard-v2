import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Site detail identifies lifecycle state and keeps normal editors read-only after termination", async () => {
  const source = await read("pages/sites/[id].vue");
  assert.match(source, /const isActive = computed\(\(\) => [^\n]*doc\.status === "ACTIVE"\)/u);
  assert.match(source, /getSiteLifecyclePresentation\(doc, \{ schedules \}\)/u);
  assert.match(source, /\{\{ lifecycle\.label \}\}/u);
  assert.match(source, /自動終了予定 \{\{ lifecycle\.automaticTerminationDate \}\}/u);
  assert.match(source, /doc\.displayName \|\| doc\.name \|\| doc\.docId/u);
  assert.match(source, /:editable="isActive"/u);
  assert.match(source, /<SiteEditorAgreements v-if="isActive"/u);
  assert.match(source, /<AgreementsViewer :agreements="doc\.agreementsV2"/u);
  assert.match(source, /<SiteEditorTerminate v-if="isActive"/u);
  assert.match(source, /<SiteEditorReactivate v-else/u);
});

test("Site lifecycle editors gate by state and use standard Manager input", async () => {
  const terminate = await read("components/Site/Editor/Terminate.vue");
  assert.match(terminate, /<SiteManager/u);
  assert.match(terminate, /lifecycle-mode="TERMINATE"/u);
  assert.match(terminate, /custom-input="SiteLifecycleInput"/u);
  assert.match(terminate, /props\.site\.status !== 'ACTIVE'/u);

  const reactivate = await read("components/Site/Editor/Reactivate.vue");
  assert.match(reactivate, /<SiteManager/u);
  assert.match(reactivate, /lifecycle-mode="REACTIVATE"/u);
  assert.match(reactivate, /custom-input="SiteLifecycleInput"/u);
  assert.match(reactivate, /props\.site\.status !== 'TERMINATED'/u);
});

test("Site lifecycle custom input writes through AirItemManager updateProperties", async () => {
  const manager = await read("components/Site/Manager/index.vue");
  const lifecycle = await read("components/Site/CustomInput/Lifecycle.vue");
  assert.match(manager, /ref="manager"/u);
  assert.match(manager, /#input-default="inputAttrs"/u);
  assert.match(manager, /manager\.value\?\.updateProperties\(changes\)/u);
  assert.match(manager, /v-bind="\{ \.\.\.inputAttrs, updateProperties \}"/u);
  assert.match(lifecycle, /updateProperties: \{ type: Function, required: true \}/u);
  assert.match(lifecycle, /props\.updateProperties\(\{ constructionPeriodStartAt: \$event \}\)/u);
  assert.match(lifecycle, /props\.updateProperties\(\{ constructionPeriodEndAt: \$event \}\)/u);
  assert.match(lifecycle, /props\.updateProperties\(\{ statusChangeReason: \$event \}\)/u);
  assert.match(lifecycle, /label="新しい工期開始日"\s+required/u);
  assert.match(lifecycle, /label="新しい工期終了日"\s+required/u);
  assert.match(lifecycle, /label="状態変更理由"\s+required/u);
  assert.doesNotMatch(lifecycle, /v-model="props\.item\.(?:constructionPeriodStartAt|constructionPeriodEndAt|statusChangeReason)"/u);
});

test("Terminated Site selection is visibly identified and requires explicit keep-terminated confirmation", async () => {
  const autocomplete = await read("components/Site/Autocomplete.vue");
  assert.match(autocomplete, /site\.status === "TERMINATED"/u);
  assert.match(autocomplete, /confirmDialog\.value = true/u);
  assert.match(autocomplete, /const context = Object\.freeze\(\{[\s\S]*companyId: auth\.companyId,[\s\S]*siteId: pendingSite\.value\.docId,[\s\S]*status: "TERMINATED",[\s\S]*\}\)/u);
  assert.match(autocomplete, /emit\("site-selection-confirmed", context\)/u);
  assert.match(autocomplete, /emit\("site-selection-confirmed", null\)/u);
  assert.match(autocomplete, /modelValue/u);
  assert.match(autocomplete, /previous|original|confirmedValue/u);
  assert.match(
    autocomplete,
    /function cancelTerminatedSelection\(\)[\s\S]*?emit\("update:model-value", (?!null)[^)]+\)/u,
  );
  assert.match(autocomplete, /onBeforeUnmount|onUnmounted/u);
  assert.doesNotMatch(autocomplete, /siteScheduleGuard/u);
  assert.match(autocomplete, /選択しても現場は再有効化されません/u);
  assert.match(autocomplete, /終了済みのまま使用/u);
  assert.doesNotMatch(autocomplete, /reactivate\s*\(/u);

  const listItem = await read("components/Site/ListItem/index.vue");
  assert.match(listItem, /getSiteLifecyclePresentation\(internalItem\)/u);
  assert.match(listItem, /\{\{ lifecycle\.label \}\}/u);
  assert.match(listItem, /自動終了予定 \{\{ lifecycle\.automaticTerminationDate \}\}/u);
  assert.match(listItem, /internalItem\.code \|\| "コード未設定"/u);

  const terminatedPage = await read("pages/sites/terminated.vue");
  assert.match(terminatedPage, /edit-icon="mdi-pencil"/u);
  assert.match(terminatedPage, /router\.push\(`\/sites\/\$\{item\.docId\}`\)/u);
});

test("Site lifecycle actions do not use dedicated Callable methods", async () => {
  const manager = await read("components/Site/Manager/index.vue");
  assert.match(manager, /lifecycleMode/u);
  assert.match(manager, /draft\.update\(\)/u);
  assert.doesNotMatch(manager, /terminateSite|reactivateSite|httpsCallable/u);
  await assert.rejects(
    access(new URL("../../composables/application/site/useSiteActions.js", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../../composables/site/useSiteFunctions.js", import.meta.url)),
  );
});

test("Schedule input keeps confirmation metadata while normal saves use Air managers and the model", async () => {
  const input = await read("components/SiteOperationSchedule/CustomInput/index.vue");
  assert.match(input, /@site-selection-confirmed="onSiteSelectionConfirmed"/u);
  assert.match(input, /clearSiteScheduleConfirmation\(props\.item\)/u);
  assert.match(input, /attachSiteScheduleConfirmation\(props\.item, \{[\s\S]*operationId: confirmationOperationId/u);
  assert.match(input, /onBeforeUnmount\(\(\) => clearSiteScheduleConfirmation\(props\.item\)\)/u);

  const submission = await read("composables/application/operation/useOperationSubmission.js");
  assert.match(submission, /await confirmTerminatedScheduleSite/u);
  assert.match(await read("components/SiteOperationSchedule/Manager/index.vue"), /<air-item-manager/u);
  assert.match(await read("handlers/siteOperationScheduleHandlers.js"), /await item\.update\(\)/u);
  assert.match(await read("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js"), /await schedule\.update\(\)/u);
  assert.match(await read("composables/useSiteOperationScheduleDuplicator.js"), /instance\.duplicate\(selectedDates\.value\)/u);
  assert.match(await read("composables/application/operation/useOperationDuplicator.js"), /submission\.submit\(operations\)/u);
  await assert.rejects(
    access(new URL("../../composables/application/operation/useOperationEditor.js", import.meta.url)),
  );

  const detail = await read("pages/sites/[id].vue");
  const arrangements = await read("components/Arrangements/Manager/index.vue");
  assert.match(detail, /<SiteOperationSchedulesManager/u);
  assert.match(arrangements, /<SiteOperationScheduleManager ref="scheduleManager"/u);
});

test("ACTIVE Site list prioritizes normal Sites before elapsed construction candidates", async () => {
  const source = await read("pages/sites/index.vue");
  const liveRead = await read("composables/dataLayers/site/useSiteUiReads.js");
  assert.match(source, /getSiteLifecyclePresentation\(left\)\.label\.startsWith\("工期終了"\)/u);
  assert.match(source, /getSiteLifecyclePresentation\(right\)\.label\.startsWith\("工期終了"\)/u);
  assert.match(
    source,
    /if\s*\(leftEnded\s*!==\s*rightEnded\)\s*return\s+Number\(leftEnded\)\s*-\s*Number\(rightEnded\)/u,
  );
  assert.match(source, /useActiveSiteLiveRead/u);
  assert.match(liveRead, /where\("status", "==", Site\.STATUS_ACTIVE\)/u);
});
