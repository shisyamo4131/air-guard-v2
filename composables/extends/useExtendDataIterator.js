/*****************************************************************************
 * @file ./composables/extends/useExtendDataIterator.js
 * @description v-data-iterator を拡張するためのコンポーザブル
 * - `modelValue` として配列以外の値を扱うことができるようになります。
 * @author shisyamo4131
 *
 * @extends props - コンポーネントに共通して適用すべきプロパティ定義
 * @extends emit - コンポーネントが emit するイベントの定義
 * @function useExtendDataIterator - v-data-iterator を拡張するためのコンポーザブル関数
 *****************************************************************************/
import * as Vue from "vue";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "@/composables/useLogger";

/**
 * @description コンポーネントに共通して適用すべきプロパティ定義です。
 * @property {Boolean} hideDefaultFooter - デフォルトのフッターを非表示にするかどうかを指定するプロパティ
 * @property {String|Number|Object|Array|Boolean} modelValue - 選択された値を受け取るプロパティ
 */
export const props = {
  hideDefaultFooter: { type: Boolean, default: false },
  modelValue: {
    type: [String, Number, Object, Array, Boolean],
    default: null,
  },
};

/**
 * @description コンポーネントが emit するイベントの定義です。
 * @event update:modelValue - 選択された値が更新されたときに emit されるイベント
 */
export const emit = ["update:modelValue"];

/**
 * @description v-data-iterator を拡張するためのコンポーザブル
 * @param {*} props
 * @param {*} emit
 */
export function useExtendDataIterator(props, emit) {
  /** SETUP LOGGER */
  const logger = useLogger("useExtendDataIterator", useErrorsStore());

  /**
   * VALIDATIONS
   * - `modelValue` プロパティが存在しない場合、警告をログに記録します。
   */
  if (!("modelValue" in props)) {
    logger.warn({
      message:
        "useExtendDataIterator requires a `modelValue` prop and `update:modelValue` event.",
    });
  }

  /**
   * @description 内部で管理する値。v-data-iterator とのバインディングモデルになるため配列。
   */
  const internalValue = Vue.ref([]);

  /**
   * @description props.modelValue が変更されたときに internalValue を更新する
   * - props.modelValue が配列であればそのまま、そうでなければ配列に変換して internalValue にセットします。
   */
  Vue.watch(
    () => props.modelValue,
    (newValue) => {
      internalValue.value = Array.isArray(newValue)
        ? [...newValue]
        : [newValue];
    },
  );

  /**
   * @description internalValue を更新し、`update:modelValue` イベントを emit する関数
   * - internalValue を更新した後、props.selectStrategy に応じて返す値を決定し、`update:modelValue` イベントを emit します。
   * @param {Array} newValue - 更新された値の配列
   */
  const setValue = (newValue) => {
    internalValue.value = newValue;
    const selectStrategy = props.selectStrategy || "single";
    const returnValue =
      selectStrategy === "single" ? newValue[0] || null : newValue;
    emit("update:modelValue", returnValue);
  };

  /**
   * @description v-data-iterator にバインドするための属性を計算する computed プロパティ
   */
  const attrs = Vue.computed(() => {
    return {
      modelValue: internalValue.value,
      "onUpdate:modelValue": setValue,
    };
  });

  return {
    attrs,
  };
}
