/*****************************************************************************
 * @file ./composables/useItemSelect.js
 * @description
 * - ダイアログベースのアイテム選択プロセスを管理するコンポーザブル。
 * - 選択時の非同期処理とダイアログ状態を一元管理し、選択されたアイテムは親コンポーネントに委譲します。
 * - VDataIteratorなどのUI選択機能と組み合わせて使用します。
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";

/**
 * @param {Object} params
 * @param {Ref<Array>} params.items アイテムのリストをrefで提供。これにより、アイテムの変更がリアクティブに反映される。
 * @param {Function} params.onSelect アイテムが選択されたときに呼び出される非同期関数。選択されたアイテムが引数として渡される。
 * @param {Function} params.onCancel ダイアログがキャンセルされたときに呼び出される関数。
 *
 * @returns {Object} アイテム選択の状態と操作を管理するオブジェクト。これには、ダイアログの表示状態、アイテムのリスト、ローディング状態、エラー状態、および選択とキャンセルのハンドラーが含まれる。
 * @returns {Ref<Boolean>} dialog ダイアログの表示状態を管理するref。trueの場合、ダイアログが表示され、falseの場合は非表示になる。
 * @returns {Ref<Array>} items アイテムのリストを管理するref。提供されたアイテムが変更された場合、内部のアイテムも更新されるようになっている。
 * @returns {Ref<Boolean>} loading アイテム選択の非同期処理のローディング状態を管理するref。trueの場合、処理が進行中であることを示し、falseの場合は処理が完了していることを示す。
 * @returns {Ref<Error|null>} error アイテム選択の非同期処理で発生したエラーを管理するref。エラーが発生した場合はそのエラーオブジェクトが格納され、エラーがない場合はnullになる。
 * @returns {Object} dialogProps ダイアログコンポーネントに渡すプロパティ。これにより、ダイアログの表示状態を管理し、ユーザーがダイアログを閉じたときにonCancelコールバックが呼び出されるようになる。
 * @returns {Function} open ダイアログを開く関数。呼び出されると、dialogの値がtrueになり、アイテム選択のUIが表示される。
 * @returns {Function} handleSelect アイテムを選択する関数。呼び出されると、dialogの値がfalseになり、アイテム選択のUIが閉じる。また、onSelectコールバックが呼び出される。
 * @returns {Function} handleCancel ダイアログを閉じる関数。呼び出されると、dialogの値がfalseになり、アイテム選択のUIが閉じる。また、onCancelコールバックが呼び出される。
 */
export function useItemSelect({
  items: providedItems = Vue.ref([]),
  onSubmit = async (item) => {},
  onCancel = () => {},
} = {}) {
  const logger = useLogger("useItemSelect");

  /**
   * 提供されたアイテムがrefであることを確認し、内部で管理するためのrefを作成
   * 提供されたアイテムが変更された場合、内部のアイテムも更新されるようにwatchを設定
   * 提供されたアイテムがrefでない場合はエラーをスロー
   */
  if (!Vue.isRef(providedItems)) {
    throw new Error("items must be a ref");
  }

  const internalItems = Vue.ref(providedItems.value);
  Vue.watch(
    providedItems,
    (newItems) => (internalItems.value = [...newItems]),
    { deep: true },
  );

  // 現在選択されているアイテム
  const selectedItem = Vue.ref(null);

  // ダイアログの表示状態を管理するref
  const dialog = Vue.ref(false);

  // ローディング状態を管理するref
  const loading = Vue.ref(false);

  // エラー状態を管理するref
  const error = Vue.ref(null);

  /**
   * ダイアログを開く関数。呼び出されると、dialogの値がtrueになり、アイテム選択のUIが表示される。
   */
  const open = () => {
    dialog.value = true;
  };

  /**
   * ダイアログを閉じる関数。呼び出されると、dialogの値がfalseになり、アイテム選択のUIが閉じる。
   * また、onCancelコールバックが呼び出される。
   */
  const handleCancel = () => {
    dialog.value = false;
    error.value = null;
    selectedItem.value = null;
    onCancel();
  };

  /**
   * アイテムを選択する関数。呼び出されると、dialogの値がfalseになり、アイテム選択のUIが閉じる。
   * また、onSubmitコールバックが呼び出される。
   * @param {*} item 選択されたアイテム
   */
  const handleSelect = (item) => {
    selectedItem.value = item;
  };

  const handleSubmit = async () => {
    if (!selectedItem.value) {
      const error = new Error("No item selected");
      error.value = error;
      logger.error({ error });
      return;
    }

    try {
      loading.value = true;
      error.value = null;
      await onSubmit(selectedItem.value);
      dialog.value = false;
    } catch (error) {
      logger.error({ error });
      error.value = error;
    } finally {
      loading.value = false;
    }
  };
  /**
   * ダイアログコンポーネントに渡すプロパティを計算するcomputedプロパティ
   * これにより、ダイアログの表示状態を管理し、ユーザーがダイアログを閉じたときにonCancelコールバックが呼び出されるようになる。
   */
  const dialogProps = Vue.computed(() => {
    return {
      modelValue: dialog.value,
      "onUpdate:modelValue": (value) => {
        dialog.value = value;
        if (!value) handleCancel();
      },
    };
  });

  return {
    // STATE
    dialog,
    error,
    items: internalItems,
    loading,
    selectedItem,

    // METHODS
    handleCancel,
    handleSubmit,
    open,
    select: handleSelect,
    isSelected: (item) => item === selectedItem.value,

    dialogProps,
  };
}
