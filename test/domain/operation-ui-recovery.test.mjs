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
  const generator = await source("composables/application/operation/useOperationGenerator.js");

  assert.doesNotMatch(generator, /operationEmployeeReferences/u);
  assert.match(generator, /notificationEmployeeReferences\(value\)/u);
  assert.match(generator, /some\(\(worker\) => !worker\.hasNotification\)/u);
});
