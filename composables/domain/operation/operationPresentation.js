import { reactive, watch } from "vue";
import { rawForClass } from "@/functions/shared/employeeContract.js";
import { operationRawFor, restoreOperationRaw } from "./operationRawContext";

const states = new WeakMap();
export function operationPresentation(model, scope) {
  const raw = operationRawFor(model, scope);
  if (!states.has(raw)) states.set(raw, reactive({ busy: false, blocked: false, revision: 0 }));
  return states.get(raw);
}
export function watchOperationRollback(source, target, scope) {
  return watch(() => {
    try { return operationPresentation(source(), scope()).revision; } catch { return null; }
  }, (revision) => {
    if (revision === null) return;
    try { const model = source(); target().initialize(rawForClass(operationRawFor(model, scope()))); restoreOperationRaw(model, target()); } catch { /* source was invalidated */ }
  });
}
