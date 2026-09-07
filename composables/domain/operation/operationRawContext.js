import { toRaw } from "vue";

const snapshots = new WeakMap();
const rows = new WeakMap();

function rememberRows(model, snapshot, source = null) {
  for (const array of ["employees", "outsourcers"]) for (const [position, worker] of (model[array] || []).entries()) {
    const previous = source ? rows.get(toRaw(source[array]?.[position])) : { array, position };
    if (previous) rows.set(toRaw(worker), { array: previous.array, position: previous.position, raw: snapshot.raw, valid: snapshot.valid });
  }
}

// Each displayed model retains the exact snapshot which produced it. A newer
// listener result must not upgrade the expectations of an older edited model.
export function createOperationRawContext() {
  let generation = 0, scope = null;
  function clear() {
    generation++;
    scope = null;
  }
  return {
    reset(nextScope) { clear(); scope = nextScope; return generation; },
    clear,
    remember(model, raw, ticket = generation) {
      if (scope === null || ticket !== generation) return false;
      const target = toRaw(model);
      const snapshot = { raw, scope, generation, valid: () => scope !== null && ticket === generation };
      snapshots.set(target, snapshot);
      rememberRows(target, snapshot);
      return true;
    },
    get generation() { return generation; },
  };
}

export function operationRawFor(model, scope) {
  const snapshot = snapshots.get(toRaw(model));
  if (!snapshot || !snapshot.valid() || snapshot.scope !== scope) throw new Error("表示情報の原本を確認できません。最新情報を読み直してください。");
  return snapshot.raw;
}

export function inheritOperationRaw(source, target) {
  const snapshot = snapshots.get(toRaw(source));
  if (!snapshot || !snapshot.valid()) return false;
  const model = toRaw(target);
  snapshots.set(model, snapshot);
  rememberRows(model, snapshot, toRaw(source));
  return true;
}

export function operationRowPosition(model, worker, scope) {
  const raw = operationRawFor(model, scope), location = rows.get(toRaw(worker));
  if (!location || !location.valid() || location.raw !== raw) return null;
  return { array: location.array, position: location.position };
}

export function restoreOperationRaw(source, target) {
  const snapshot = snapshots.get(toRaw(source));
  if (!snapshot || !snapshot.valid()) return false;
  const model = toRaw(target);
  snapshots.set(model, snapshot); rememberRows(model, snapshot); return true;
}
