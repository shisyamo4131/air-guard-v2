/*****************************************************************************
 * @file ./components/OperationResult/Duplicator/useIndex.js
 * @description `OperationResultDuplicator` 専用 Facade コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { OperationResult } from "@/schemas";
import { useDuplicate } from "@/composables/application/operationResult/useDuplicate";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/**
 * @param {(event: "duplicated", instance: OperationResult) => void} emit
 * @returns {{ ui: import("vue").ComputedRef, set: (doc: OperationResult) => void }}
 */
export function useIndex(emit) {
  /*****************************************************************************
   * DEFINE STATES
   *****************************************************************************/
  const dialog = Vue.ref(false); // ダイアログの開閉状態
  const source = Vue.reactive(new OperationResult()); // 複製対象の稼働実績インスタンス
  const selectedDate = Vue.ref(null); // 複製先の日付

  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { duplicate, loading } = useDuplicate();
  const logger = useLogger("OperationResultDuplicator", useErrorsStore());

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 複製対象の稼働実績インスタンスを設定し、ダイアログを表示する
   * @param {OperationResult} doc - 複製対象の稼働実績インスタンス
   * @returns {void}
   */
  function set(doc) {
    if (!doc || !(doc instanceof OperationResult)) {
      const error = new Error(
        "doc is required and must be an instance of OperationResult",
      );
      logger.error({ error });
      return; // エラーの場合は処理を中断
    }
    if (doc.isLocked) {
      const error = new Error("doc is locked and cannot be duplicated");
      logger.error({ error });
      return; // エラーの場合は処理を中断
    }
    source.initialize(doc.toObject());
    dialog.value = true;
  }

  /**
   * 複製処理を実行し、複製された稼働実績インスタンスを `duplicated` イベントとして emit する
   * @returns {Promise<void>}
   */
  async function onClickSubmit() {
    const dates = selectedDate.value ? [selectedDate.value] : [];
    const instances = await duplicate({ source, dates });
    if (!instances || instances.length === 0) return;
    emit("duplicated", instances[0]);
  }

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * `dialog` を監視し、ダイアログが閉じられた際に `selectedDate` をクリアします。
   */
  Vue.watch(dialog, (newValue) => {
    if (newValue) return;
    selectedDate.value = null;
  });

  /*****************************************************************************
   * COMPUTED
   *****************************************************************************/
  /**
   * `selectedDate` が未選択、または複製処理中、または `source` がロックされている場合にアクションを無効化する
   */
  const disabledActions = Vue.computed(() => {
    return !selectedDate.value || loading.value || source.isLocked;
  });

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    ui: Vue.computed(() => {
      return {
        dialog: {
          modelValue: dialog.value,
          width: 328, // `v-date-picker` の幅に合わせる
          "onUpdate:modelValue": (value) => (dialog.value = value),
        },
        picker: {
          modelValue: selectedDate.value,
          "onUpdate:modelValue": (value) =>
            (selectedDate.value = value ?? null),
          hideHeader: true,
          multiple: false, // 稼働実績の複製は1日ずつ行う
        },
        actions: {
          // 複製先の日付が選択されていない場合は無効化
          disabled: disabledActions.value,
          loading: loading.value,
          "onClick:cancel": () => (dialog.value = false),
          "onClick:submit": onClickSubmit,
        },
      };
    }),
    set,
  };
}
