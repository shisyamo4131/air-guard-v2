/*****************************************************************************
 * @file ./composables/useDialogSelector.js
 * @description アイテム選択ダイアログ専用コンポーザブル
 * - ダイアログを使用したアイテム選択用コンポーネントに共通して適用するプロパティとロジックを提供します。
 *****************************************************************************/
import * as Vue from "vue";

/**
 * @description コンポーネントに共通して適用すべきプロパティ定義です。
 * @property {Boolean} clearOnSelect - 選択後に選択状態をクリアするかどうかを指定するプロパティ
 * @property {Object|Array|String|Number|Boolean} modelValue - 選択された値を受け取るプロパティ
 * @property {Boolean} returnObject - true の場合、選択されたオブジェクト全体を返します。false の場合、選択された値のみを返します。
 * @property {String} selectStrategy - 選択戦略を指定するプロパティ。例: "single"（単一選択）や "page"（ページ単位選択）や "all"（全選択）など。
 */
export const props = {
  clearOnSelect: { type: Boolean, default: false }, // 選択後に選択状態をクリアするかどうか
  modelValue: { type: [Object, Array, String, Number, Boolean], default: null },
  returnObject: { type: Boolean, default: false },
  selectStrategy: {
    type: String,
    default: "single",
    validator: (value) => ["single", "page", "all"].includes(value),
  },
};

/**
 * @description コンポーネントが emit するイベントの定義です。
 * @event update:modelValue - 選択された値が更新されたときに emit されるイベント
 */
export const emits = ["update:modelValue"];

/**
 * @description アイテム選択ダイアログ専用コンポーザブル関数
 * @param {*} props - コンポーネントのプロパティ
 * @param {*} emit - コンポーネントのイベントエミッター
 * @returns {Object} ダイアログの状態と操作関数を返すオブジェクト
 * @returns {Ref<Boolean>} dialog - ダイアログの表示状態を管理するリアクティブな参照
 * @returns {Ref} selectedValue - 選択された値を管理するリアクティブな参照
 * @returns {Function} onSubmit - 確定処理関数。選択された値を emit し、ダイアログを閉じます。
 * @returns {Function} onCancel - キャンセル処理関数。選択を元に戻し、ダイアログを閉じます。
 */
export function useDialogSelector(props, emit) {
  /*****************************************************************************
   * STATES
   *****************************************************************************/
  const dialog = Vue.ref(false); // ダイアログの状態
  const selectedValue = Vue.ref(null); // 選択された値

  /*****************************************************************************
   * PRIVATE METHODS
   *****************************************************************************/

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(
    () => props.modelValue,
    (newValue) => {
      selectedValue.value = newValue;
    },
    { immediate: true },
  );
  /*****************************************************************************
   * PUBLIC METHODS
   *****************************************************************************/
  /**
   * 確定処理関数
   * - `update:modelValue` イベントを emit し、`dialog` を false に更新します。
   */
  const onSubmit = () => {
    emit("update:modelValue", selectedValue.value);
    if (props.clearOnSelect) selectedValue.value = null;
    dialog.value = false;
  };

  /**
   * キャンセル処理関数
   * - `selectedValue` を `props.modelValue` で初期化し、`dialog` を false に更新します。
   */
  const onCancel = () => {
    selectedValue.value = props.modelValue; // キャンセル時は選択を元に戻す
    dialog.value = false;
  };

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  const iteratorProps = Vue.computed(() => {
    return {
      modelValue: selectedValue.value,
      "onUpdate:modelValue": (value) => {
        selectedValue.value = value;
      },
      returnObject: props.returnObject,
      selectStrategy: props.selectStrategy,
      showSelect: true, // アイテムに選択UIを表示するためのフラグ
    };
  });
  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    dialog,
    selectedValue,
    iteratorProps,
    onSubmit,
    onCancel,
  };
}
