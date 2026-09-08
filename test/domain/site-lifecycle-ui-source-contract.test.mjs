import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Site detail identifies lifecycle state and keeps normal editors read-only after termination", async () => {
  const source = await read("pages/sites/[id].vue");
  assert.match(source, /const isActive = computed\(\(\) => [^\n]*doc\.status === "ACTIVE"\)/u);
  assert.match(source, /getSiteLifecyclePresentation\(doc, \{ schedules \}\)/u);
  assert.match(source, /\{\{ lifecycle\.label \}\}/u);
  assert.match(source, /自動終了予定 \{\{ lifecycle\.automaticTerminationDate \}\}/u);
  assert.match(source, /doc\.displayName \|\| doc\.name \|\| doc\.docId/u);
  assert.match(source, /:editable="canWrite && isActive"/u);
  assert.match(source, /<SiteEditorAgreements v-if="canWrite && isActive"/u);
  assert.match(source, /<AgreementsViewer :agreements="doc\.agreementsV2"/u);
  assert.match(source, /<SiteEditorTerminate v-if="isActive"/u);
  assert.match(source, /<SiteEditorReactivate v-else/u);
});

test("Site lifecycle dialogs gate by state and submit only exact callable inputs", async () => {
  const terminate = await read("components/Site/Editor/Terminate.vue");
  assert.match(terminate, /!canWrite\.value \|\| props\.site\.status !== "ACTIVE"/u);
  assert.match(terminate, /terminate\(\{ siteId: props\.site\.docId, reason: normalized \}\)/u);
  assert.match(terminate, /maxlength="200"/u);
  assert.match(terminate, /getSiteOperationErrorMessage/u);

  const reactivate = await read("components/Site/Editor/Reactivate.vue");
  assert.match(reactivate, /!canWrite\.value \|\| props\.site\.status !== "TERMINATED"/u);
  assert.match(reactivate, /reactivate\(\{[\s\S]*siteId: props\.site\.docId,[\s\S]*reason: normalized,[\s\S]*constructionPeriodStartDate: startDate\.value,[\s\S]*constructionPeriodEndDate: endDate\.value/u);
  assert.match(reactivate, /startDate\.value > endDate\.value/u);
  assert.match(reactivate, /取引先は変更せず/u);
  assert.doesNotMatch(reactivate, /customerId\s*:/u);
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
  assert.match(terminatedPage, /:edit-icon="canWrite \? 'mdi-pencil' : 'mdi-eye'"/u);
  assert.match(terminatedPage, /router\.push\(`\/sites\/\$\{item\.docId\}`\)/u);
});

test("Site actions keep lifecycle calls inside the shared single-flight permission boundary", async () => {
  const source = await read("composables/application/site/useSiteActions.js");
  assert.match(source, /const siteFunctions = useSiteFunctions\(\)/u);
  assert.match(source, /async function terminate\(\{ siteId, reason \}\)[\s\S]*executeSiteWrite\(SITE_WRITE_OPERATION\.TERMINATE[\s\S]*assertWritePermission\(\)[\s\S]*siteFunctions\.terminateSite\(\{ siteId, reason \}\)/u);
  assert.match(source, /async function reactivate\([\s\S]*executeSiteWrite\(SITE_WRITE_OPERATION\.TERMINATE[\s\S]*assertWritePermission\(\)[\s\S]*siteFunctions\.reactivateSite/u);
});

test("Schedule editor owns confirmation lifecycle and preset paths inject the same explicit prompt", async () => {
  const input = await read("components/SiteOperationSchedule/CustomInput/index.vue");
  assert.match(input, /@site-selection-confirmed="onSiteSelectionConfirmed"/u);
  assert.match(input, /clearSiteScheduleConfirmation\(props\.item\)/u);
  assert.match(input, /attachSiteScheduleConfirmation\(props\.item, \{[\s\S]*operationId: confirmationOperationId/u);
  assert.match(input, /onBeforeUnmount\(\(\) => clearSiteScheduleConfirmation\(props\.item\)\)/u);

  const editor = await read("composables/application/operation/useOperationEditor.js");
  const submission = await read("composables/application/operation/useOperationSubmission.js");
  assert.match(editor, /await confirmTerminatedScheduleSite/u);
  assert.match(submission, /await confirmTerminatedScheduleSite/u);
  assert.match(await read("components/SiteOperationSchedule/Manager/index.vue"), /OperationManager/u);
  assert.match(await read("composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js"), /useOperationSubmission\(\s*\{\s*concurrent:\s*true\s*\}\s*\)/u);
  assert.match(await read("composables/useSiteOperationScheduleDuplicator.js"), /useOperationDuplicator\("schedule"\)/u);
  assert.match(await read("composables/application/operation/useOperationDuplicator.js"), /submission\.submit\(operations\)/u);

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
