import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("OperationBilling detail connects each editor and explains the complete amount", async () => {
  const [manager, page, detail] = await Promise.all([
    source("components/OperationBilling/Manager/index.vue"),
    source("pages/billings/operations/[id].vue"),
    source("components/OperationBilling/Table/BillingDetail.vue"),
  ]);

  assert.match(manager, /:custom-input="props\.customInput"/u);
  assert.match(page, /action="agreement"[\s\S]*?:custom-input="AgreementInput"/u);
  assert.match(page, /action="adjusted"[\s\S]*?:custom-input="AdjustInput"/u);
  assert.match(detail, /作業員分 小計/u);
  assert.match(detail, /props\.item\.salesArticles/u);
  assert.match(detail, /props\.item\.taxRate/u);
  assert.match(detail, /props\.item\.salesAmount/u);
  assert.match(detail, /税抜合計/u);
});

test("OperationSchedules row actions reach the manager and use named buttons", async () => {
  const [manager, add, remove] = await Promise.all([
    source("components/OperationSchedules/Manager/index.vue"),
    source("components/OperationSchedules/Table/AddScheduleIcon.vue"),
    source("components/OperationSchedules/Table/RemoveSiteOrderIcon.vue"),
  ]);

  assert.match(manager, /@click:add-schedule="createSiteOperationSchedule"/u);
  assert.match(manager, /@click:remove-site-order="removeSiteShiftTypeOrder"/u);
  assert.match(manager, /new SiteOperationSchedule\(\{[\s\S]*?siteId: row\?\.siteId,[\s\S]*?shiftType: row\?\.shiftType/u);
  for (const control of [add, remove]) {
    assert.match(control, /<v-btn/u);
    assert.match(control, /:aria-label="ariaLabel"/u);
  }
});

test("OperationResult keeps its historical security type until the same draft changes Site", async () => {
  const input = await source("components/OperationResult/CustomInput/index.vue");

  assert.match(
    input,
    /async \(\[item, siteId\], \[oldItem, oldSiteId\] = \[\]\) => \{\s*if \(item !== oldItem \|\| siteId === oldSiteId\) return;/u,
  );
  assert.doesNotMatch(input, /immediate:\s*true/u);
  assert.match(
    input,
    /if \(request\.isCurrent\(\) && site\?\.securityType\) \{\s*props\.updateProperties\(\{ securityType: site\.securityType \}\);/u,
  );
});

test("OperationResult generation leaves duplicate prevention to schedule editing", async () => {
  const generator = await source("components/OperationResult/Generator/index.vue");

  assert.doesNotMatch(generator, /useOperationGenerator|saveOperation|Callable|action:\s*["']convert/u);
  assert.doesNotMatch(generator, /schedule\.notify\(|\.notify\(/u);
  assert.match(generator, /await targetSchedule\.syncToOperationResult\(targetNotificationsMap\)/u);
  assert.match(generator, /<SiteOperationSchedulesManager[\s\S]*?:before-edit="beforeEdit"/u);
  assert.match(generator, /#table="\{ items, toUpdate, isLoading \}"/u);
  assert.match(generator, /@click:submit="toUpdate\(selectedSchedule\)"/u);
  assert.match(generator, /<div class="operation-result-generator d-flex flex-column fill-height overflow-hidden" style="min-height: 0">[\s\S]*?<SiteOperationSchedulesManager[\s\S]*?class="flex-grow-1 overflow-hidden"[\s\S]*?style="min-height: 0"[\s\S]*?<\/SiteOperationSchedulesManager>[\s\S]*?<v-dialog[\s\S]*?persistent[\s\S]*?<\/v-dialog>[\s\S]*?<\/div>/u);
  assert.doesNotMatch(generator, /notificationRetryAvailable|配置通知を再取得|上下番情報を再読込|>再読込<\/v-btn>/u);
  assert.match(generator, /error\.value = "配置通知を取得できません。予定を再選択するか、画面を再表示してください。"/u);
  assert.match(generator, /if \(!ready\.value\) \{\s*error\.value = "配置通知を確認できません。予定を再選択するか、画面を再表示してください。";\s*return false;\s*\}/u);
  assert.match(generator, /if \(item\?\.docId !== selectedSchedule\.value\?\.docId\) \{\s*error\.value = "選択中の予定が変わりました。再選択してから再実行してください。";\s*return false;\s*\}/u);
  assert.doesNotMatch(generator, /v-if="error && selectedSchedule"/u);
  const listTag = generator.slice(generator.indexOf("<List"), generator.indexOf("/>", generator.indexOf("<List")));
  const detailTag = generator.slice(generator.indexOf("<Detail"), generator.indexOf("/>", generator.indexOf("<Detail")));
  assert.match(listTag, /:loading="isLoading \|\| confirming"/u);
  assert.doesNotMatch(listTag, /preparing|!ready/u);
  assert.doesNotMatch(listTag, /!ready/u);
  assert.match(detailTag, /:loading="isLoading \|\| preparing \|\| confirming \|\| !ready"/u);
  assert.ok(generator.indexOf("ready.value = false") < generator.indexOf("fetchDocs"));
  assert.ok(generator.indexOf("fetchDocs") < generator.indexOf("subscribeDocs"));
  assert.ok(generator.indexOf("subscribeDocs") < generator.indexOf("ready.value = true"));
  assert.match(generator, /beforeEdit\(editMode, item\)[\s\S]*?ready\.value[\s\S]*?item\?\.docId !== selectedSchedule\.value\?\.docId[\s\S]*?syncToOperationResult\(targetNotificationsMap\)/u);
  assert.doesNotMatch(generator, /notification\.status\s*=|notification\.update\(/u);
});
