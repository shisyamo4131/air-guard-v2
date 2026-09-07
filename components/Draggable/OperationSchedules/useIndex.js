import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { inheritOperationRaw } from "@/composables/domain/operation/operationRawContext";
import { operationPresentation } from "@/composables/domain/operation/operationPresentation";
import { useAuthStore } from "@/stores/useAuthStore";
import { createDraggableFallbackOptions } from "@/composables/application/draggable/createDraggableFallbackOptions";

export function useIndex(props, emit) {
  const auth = useAuthStore(), scope = () => `${auth.companyId}/${auth.uid}`;
  const pending = Vue.computed(() => props.schedules.some((model) => { try { const state = operationPresentation(model, scope()); return state.busy || state.blocked; } catch { return true; } }));
  /*****************************************************************************
   * SETUP STATES
   *****************************************************************************/
  // 内部管理用の schedule オブジェクト配列
  const internalSchedules = Vue.ref(props.schedules || []);
  Vue.watch(
    () => props.schedules,
    (newSchedules) => {
      internalSchedules.value = newSchedules.map(
        (s) => { const model = new SiteOperationSchedule(s); inheritOperationRaw(s, model); return model; },
      );
      internalSchedules.value.sort((a, b) => a.displayOrder - b.displayOrder);
    },
    { immediate: true, deep: true },
  );
  Vue.watch(() => props.schedules.map((model) => { try { return operationPresentation(model, scope()).revision; } catch { return null; } }), () => {
    internalSchedules.value = props.schedules.map((model) => { const copy = new SiteOperationSchedule(model); inheritOperationRaw(model, copy); return copy; }).sort((a, b) => a.displayOrder - b.displayOrder);
  });

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 引数で受け取ったスケジュール配列を内部状態に反映し、親コンポーネントに更新を通知します。
   * - Optimistic Update のため、内部状態を先に更新してから親コンポーネントに通知します。
   * @param {Array} newSchedules - ドラッグアンドドロップ後の新しいスケジュール配列
   * @returns {void}
   */
  function handleUpdateModelValue(newSchedules) {
    if (props.disabled || pending.value) return;
    internalSchedules.value = newSchedules;
    emit("update:schedules", newSchedules);
  }

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  // draggable コンポーネントに渡す属性
  const attrs = Vue.computed(() => {
    return {
      disabled: props.disabled || pending.value,
      group: { name: props.groupName },
      handle: props.handle,
      itemKey: props.itemKey,
      modelValue: internalSchedules.value,
      "onUpdate:modelValue": handleUpdateModelValue,

      // 以下、スマホやタブレット端末においてドラッグ中の要素をPCと同様に取り扱うための追加設定
      // この設定を行わないと、ドラッグ中の要素が親コンテナの描画範囲からはみ出ないなどの問題が発生する
      ...createDraggableFallbackOptions(),
    };
  });

  // デフォルトスロットに渡すプロパティ
  const defaultSlotProps = Vue.computed(() => {
    return {
      disabled: props.disabled || pending.value,
    };
  });

  return {
    attrs,
    defaultSlotProps,
  };
}
