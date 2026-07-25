/*****************************************************************************
 * @file ./composables/validators/rangeValidator.js
 * @description 期間に関する検証用関数を提供します。
 *****************************************************************************/
import * as Vue from "vue";

/**
 * @description `from` および `to` が Ref<Date> であることを検証します。
 * @param {{ from: Ref<Date>, to: Ref<Date> }} options - 検証対象のオブジェクト
 * @throws {TypeError} `from` または `to` が Ref<Date> でない場合にスローされます。
 */
export function rangeIsRef({ from, to } = {}) {
  if (!Vue.isRef(from) || !Vue.isRef(to)) {
    console.error({ from, to });
    throw new TypeError(
      "Invalid 'from' or 'to' option. Both must be Ref<Date>.",
    );
  }
}

/**
 * @description `from` および `to` が有効な日付範囲であることを検証します。
 * @param {{ from: Ref<Date>, to: Ref<Date> }} options - 検証対象のオブジェクト
 * @throws {TypeError} `from` または `to` が Date インスタンスでない場合にスローされます。
 * @throws {RangeError} `from` が `to` よりも後の日付である場合にスローされます。
 */
export function rangeIsValid({ from, to } = {}) {
  const normalizedFrom = Vue.unref(from);
  const normalizedTo = Vue.unref(to);
  if (!(normalizedFrom instanceof Date) || !(normalizedTo instanceof Date)) {
    console.error({ from, to });
    throw new TypeError(
      "Invalid 'from' or 'to' value. Both must be Date instances.",
    );
  }

  if (normalizedFrom > normalizedTo) {
    console.error({ from, to });
    throw new RangeError("'from' must be earlier than or equal to 'to'.");
  }
}
