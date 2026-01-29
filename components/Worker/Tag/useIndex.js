/*****************************************************************************
 * WorkerTag 専用コンポーザブル
 *****************************************************************************/
import dayjs from "dayjs";
import * as Vue from "vue";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import EmployeeTag from "@/components/Employee/Tag/index.vue";
import OutsourcerTag from "@/components/Outsourcer/Tag/index.vue";

export function useIndex(props, emit) {
  /**
   * 引数で受け取った値を時刻文字列に変換して返します。
   * - 引数が空の場合は "--:--" を返します。
   * - 引数が文字列の場合はそのまま返します。
   * - 引数が Date オブジェクトの場合は "HH:mm" 形式の文字列に変換して返します。（Asia/Tokyo タイムゾーン）
   * @param {String|Date} time
   * @returns {String} 変換後の時刻文字列
   */
  const resolveTime = (time) => {
    if (!time) return "--:--";
    if (typeof time === "string") return time;
    return dayjs(time).tz("Asia/Tokyo").format("HH:mm");
  };

  /**
   * 開始時刻の算出
   */
  const startTime = Vue.computed(() => {
    return resolveTime(props.startTime);
  });

  /**
   * 終了時刻の算出
   */
  const endTime = Vue.computed(() => {
    return resolveTime(props.endTime);
  });

  // isEmployeeに応じて使用するコンポーネントタグを決定
  const componentTag = Vue.computed(() => {
    return props.isEmployee ? EmployeeTag : OutsourcerTag;
  });

  // useFetchEmployeeのインスタンス取得（propsで渡されたものか、新規作成）
  const fetchEmployeeComposable =
    props.fetchEmployeeComposable || useFetchEmployee();

  // useFetchOutsourcerのインスタンス取得（propsで渡されたものか、新規作成）
  const fetchOutsourcerComposable =
    props.fetchOutsourcerComposable || useFetchOutsourcer();

  /**
   * 子コンポーネント（EmployeeTag/OutsourcerTag）に渡す属性の算出
   */
  const attrs = Vue.computed(() => {
    const baseAttrs = {
      docId: props.id,
      "onClick:remove": () => emit("click:remove"),
    };

    // isEmployeeに応じて適切なpropsを渡す
    if (props.isEmployee) {
      return {
        ...props,
        ...baseAttrs,
        fetchEmployeeComposable: fetchEmployeeComposable,
      };
    } else {
      return {
        ...props,
        ...baseAttrs,
        fetchOutsourcerComposable: fetchOutsourcerComposable,
      };
    }
  });

  return { componentTag, attrs, startTime, endTime };
}
