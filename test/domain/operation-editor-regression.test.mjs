import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as Vue from "vue";
import { Timestamp } from "firebase/firestore";
import { SiteOperationSchedule } from "@shisyamo4131/air-guard-v2-schemas";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { createOperationRawContext, inheritOperationRaw, operationRawFor, operationRowPosition, restoreOperationRaw } from "../../composables/domain/operation/operationRawContext.js";
import { rawForClass } from "../../functions/shared/employeeContract.js";

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
function operation() {
  const model = new SiteOperationSchedule({ docId: "operation", siteId: "site", dateAt: new Date("2026-09-01"), startTime: "08:00", endTime: "17:00" });
  model.addWorker({ id: "first", isEmployee: true }, -1); model.addWorker({ id: "second", isEmployee: true }, -1);
  return model.toObject();
}

test("raw context survives card and draggable copies while retaining nanosecond precision and row positions", () => {
  const context = createOperationRawContext();
  const scope = context.reset("company/actor");
  const raw = operation(); raw.employees[0].updatedAt = new Timestamp(1788200000, 123456789);
  const displayed = Vue.reactive(new SiteOperationSchedule(raw));
  assert.equal(context.remember(displayed, raw, scope), true);
  const card = Vue.reactive(new SiteOperationSchedule(displayed)); inheritOperationRaw(displayed, card);
  const drag = Vue.reactive(new SiteOperationSchedule(card)); inheritOperationRaw(card, drag);
  const second = drag.employees[1]; drag.employees.reverse();
  assert.deepEqual(operationRowPosition(displayed, second, "company/actor"), { array: "employees", position: 1 });
  assert.strictEqual(operationRawFor(drag, "company/actor"), raw);
  assert.equal(operationRawFor(drag, "company/actor").employees[0].updatedAt.nanoseconds, 123456789);
  assert.equal(Object.keys(drag.toObject()).some((key) => /context|generation|position/i.test(key)), false);
  context.reset("other/actor");
  for (const model of [displayed, card, drag]) assert.throws(() => operationRawFor(model, "company/actor"));
  assert.equal(context.remember(displayed, raw, scope), false);
  assert.equal(restoreOperationRaw(card, drag), false);
});

test("operation generator preserves independently scrollable list/detail regions and guarded confirmation flow", async () => {
  const generator = await source("components/OperationResult/Generator/index.vue");
  const list = await source("components/OperationResult/Generator/List.vue");
  const detail = await source("components/OperationResult/Generator/Detail.vue");
  assert.match(generator, /const preparing = ref\(false\);\s*const confirming = ref\(false\);/u);
  assert.match(generator, /if \(confirming\.value\) return false;/u);
  assert.match(generator, /await targetSchedule\.syncToOperationResult\(targetNotificationsMap\)/u);
  assert.match(generator, /<v-dialog v-model="confirming" persistent/u);
  assert.match(list, /flex-grow-1 overflow-y-auto/u);
  assert.match(detail, /flex-grow-1 overflow-y-auto/u);
  assert.doesNotMatch(generator, /useOperationGenerator|saveOperation|action:\s*["']convert/u);
  for (const [path, code] of [["components/OperationResult/Generator/index.vue", generator], ["components/OperationResult/Generator/List.vue", list], ["components/OperationResult/Generator/Detail.vue", detail]]) {
    const { descriptor, errors } = parse(code, { filename: path });
    assert.deepEqual(errors, [], path);
    const script = compileScript(descriptor, { id: path });
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: path, compilerOptions: { bindingMetadata: script.bindings } }).errors, [], path);
  }
});

test("arrangement-style local synchronization updates only the selected document and keeps an edited clone usable", async () => {
  const docs = Vue.reactive([{ docId: "a", status: "ARRANGED" }, { docId: "b", status: "ARRANGED" }]);
  const selected = Vue.ref("a"), internal = Vue.reactive({ docId: "a", status: "ARRANGED" });
  const snapshot = Vue.ref(null);
  const sync = () => {
    const latest = docs.find((item) => item.docId === selected.value); if (!latest) return false;
    const next = { ...latest }; if (JSON.stringify(next) === JSON.stringify(snapshot.value)) return false;
    Object.assign(internal, next); snapshot.value = next; return true;
  };
  assert.equal(sync(), true);
  docs[0] = { docId: "a", status: "CONFIRMED" }; assert.equal(sync(), true); assert.equal(internal.status, "CONFIRMED");
  const before = { ...internal }; docs[1] = { docId: "b", status: "ARRIVED" }; assert.equal(sync(), false); assert.deepEqual({ ...internal }, before);
  selected.value = "b"; assert.equal(sync(), true); assert.equal(internal.status, "ARRIVED");
  assert.equal(rawForClass({ uid: "actor", docId: "b" }).uid, "actor");
});
