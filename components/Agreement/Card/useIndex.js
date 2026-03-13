/*****************************************************************************
 * @file ./components/Agreement/Card/useIndex.js
 * @description AgreementCard 専用コンポーザブル
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import dayjs from "dayjs";
import { formatCurrency } from "@/utils/formats/util";
import { useConstants } from "@/composables/useConstants";

/**
 * AgreementCard 専用コンポーザブル
 * @param {Object} props - AgreementCard コンポーネントの props を受け取るオブジェクト
 * @param {Object} emit - AgreementCard コンポーネントの emit 関数
 * @returns {Object} AgreementCard コンポーネントで使用する computed プロパティを返すオブジェクト
 * @returns {ComputedRef<String>} dateAtLabel - 契約の開始日をフォーマットして表示するための computed プロパティ
 * @returns {ComputedRef<String>} dayTypeLabel - 契約の勤務形態に応じて、勤務形態のラベルを表示するための computed プロパティ
 * @returns {ComputedRef<String>} shiftTypeColor - 契約のシフトタイプに応じて、シフトタイプの色を表示するための computed プロパティ
 * @returns {ComputedRef<String>} shiftTypeLabel - 契約のシフトタイプに応じて、シフトタイプのラベルを表示するための computed プロパティ
 * @returns {ComputedRef<Object>} formatted - 契約の料金情報をフォーマットして表示するための computed プロパティ
 * @returns {ComputedRef<String>} selectIcon - 選択チェックボックスのアイコンを表示するための computed プロパティ
 */
export function useIndex(props, emit) {
  const { DAY_TYPE, SHIFT_TYPE } = useConstants();

  /** 単価情報表示切替スイッチ用 */
  const isExpanded = Vue.ref(false);

  /**
   * 契約の開始日をフォーマットして表示するためのcomputedプロパティ。
   * 契約の開始日を"YYYY年MM月DD日(ddd)"の形式で表示するために、dayjsライブラリを使用。
   */
  const dateAtLabel = Vue.computed(() => {
    return `${dayjs(props.agreement.dateAt).format("YYYY年MM月DD日(ddd)")}`;
  });

  /**
   * 契約の料金情報をフォーマットして表示するためのcomputedプロパティ。
   * 契約の料金情報を通貨形式で表示するために、formatCurrency関数を使用。
   * また、契約のbillingUnitTypeに応じて、単位を"時間"または"人工"として表示する。
   */
  const formatted = Vue.computed(() => {
    const agreement = props.agreement;
    const unit = agreement.billingUnitType === "HOUR" ? "/時間" : "/人工";
    const overtimeUnit = "/時間";
    const unitPriceBase = formatCurrency(agreement.unitPriceBase);
    const overTimeUnitPriceBase = formatCurrency(
      agreement.overtimeUnitPriceBase,
    );
    const unitPriceQualified = formatCurrency(agreement.unitPriceQualified);
    const overTimeUnitPriceQualified = formatCurrency(
      agreement.overtimeUnitPriceQualified,
    );
    return {
      unitPriceBase: unitPriceBase + unit,
      overTimeUnitPriceBase: overTimeUnitPriceBase + overtimeUnit,
      unitPriceQualified: unitPriceQualified + unit,
      overTimeUnitPriceQualified: overTimeUnitPriceQualified + overtimeUnit,
    };
  });

  /**
   * 契約の勤務形態に応じて、勤務形態のラベルを表示するためのcomputedプロパティ。
   * DAY_TYPEとSHIFT_TYPEの定数を使用して、契約の勤務形態に対応するラベルを取得。
   * もし、契約の勤務形態が定数に存在しない場合は、空文字列を返す。
   */
  const dayTypeLabel = Vue.computed(() => {
    return DAY_TYPE.value[props.agreement.dayType]?.title || "";
  });

  /**
   * 契約のシフトタイプに応じて、シフトタイプの色を表示するためのcomputedプロパティ。
   * SHIFT_TYPEの定数を使用して、契約のシフトタイプに対応する色を取得。
   * もし、契約のシフトタイプが定数に存在しない場合は、undefinedを返す。
   */
  const shiftTypeColor = Vue.computed(() => {
    return SHIFT_TYPE.value[props.agreement.shiftType]?.color || undefined;
  });

  /**
   * 契約のシフトタイプに応じて、シフトタイプのラベルを表示するためのcomputedプロパティ。
   * SHIFT_TYPEの定数を使用して、契約のシフトタイプに対応するラベルを取得。
   * もし、契約のシフトタイプが定数に存在しない場合は、空文字列を返す。
   */
  const shiftTypeIcon = Vue.computed(() => {
    return SHIFT_TYPE.value[props.agreement.shiftType]?.icon || undefined;
  });

  /**
   * 契約のシフトタイプに応じて、シフトタイプのラベルを表示するためのcomputedプロパティ。
   * SHIFT_TYPEの定数を使用して、契約のシフトタイプに対応するラベルを取得。
   * もし、契約のシフトタイプが定数に存在しない場合は、空文字列を返す。
   */
  const shiftTypeLabel = Vue.computed(() => {
    return SHIFT_TYPE.value[props.agreement.shiftType]?.title || "";
  });

  /**
   * 選択チェックボックスのアイコンを表示するためのcomputedプロパティ。
   * props.isSelectedがtrueの場合は、"mdi-checkbox-outline"を表示し、falseの場合は"mdi-checkbox-blank-outline"を表示する。
   */
  const selectIcon = Vue.computed(() => {
    return props.isSelected
      ? "mdi-checkbox-outline"
      : "mdi-checkbox-blank-outline";
  });

  /**
   * 選択チェックボックスコンポーネントに引き渡すプロパティ
   */
  const selectIconProps = Vue.computed(() => {
    return {
      disabled: props.disabled,
      loading: props.loading,
      icon: selectIcon.value,
      onClick: () => emit("click:select"),
    };
  });

  /**
   * 時間を表すラベルを返す計算プロパティ
   */
  const timeLabel = Vue.computed(() => {
    const startTime = props.agreement.startTime;
    const endTime = props.agreement.endTime;
    return `${startTime} - ${endTime}`;
  });

  Vue.provide("props", props);
  Vue.provide("emit", emit);
  Vue.provide("isExpanded", isExpanded);

  return {
    dateAtLabel,
    dayType: Vue.computed(() => props.agreement.dayType),
    dayTypeLabel,
    shiftType: Vue.computed(() => props.agreement.shiftType),
    shiftTypeColor,
    shiftTypeIcon,
    shiftTypeLabel,
    formatted,
    selectIcon,
    selectIconProps,
    timeLabel,
    isExpanded,
  };
}
