/*****************************************************************************
 * @file ./composables/useOperationState.js
 * @description operation・target単位のpending状態と実行中Promiseを管理します。
 *****************************************************************************/
import { computed, shallowReactive } from "vue";

function resolveOperationKey(operation, targetId) {
  if (
    typeof operation !== "string" ||
    !operation ||
    operation.trim() !== operation ||
    typeof targetId !== "string" ||
    !targetId ||
    targetId.trim() !== targetId
  ) {
    throw new TypeError("operation and targetId must be non-empty strings.");
  }
  return `${operation}:${targetId}`;
}

export function useOperationState() {
  const pending = shallowReactive(new Map());

  function isPending(operation, targetId) {
    return pending.has(resolveOperationKey(operation, targetId));
  }

  function run(operation, targetId, action) {
    if (typeof action !== "function") {
      throw new TypeError("action must be a function.");
    }

    const key = resolveOperationKey(operation, targetId);
    const existing = pending.get(key);
    if (existing) return existing;

    let trackedPromise;
    trackedPromise = Promise.resolve()
      .then(action)
      .finally(() => {
        if (pending.get(key) === trackedPromise) pending.delete(key);
      });
    pending.set(key, trackedPromise);
    return trackedPromise;
  }

  return {
    hasPending: computed(() => pending.size > 0),
    isPending,
    run,
  };
}
