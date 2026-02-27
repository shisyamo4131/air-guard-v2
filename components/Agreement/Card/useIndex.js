import * as Vue from "vue";
import dayjs from "dayjs";
import { formatCurrency } from "@/utils/formats/util";

export function useIndex(props) {
  const label = Vue.computed(() => {
    return `${dayjs(props.agreement.dateAt).format("YYYY年MM月DD日(ddd)")} ～`;
  });

  const formatted = Vue.computed(() => {
    const unit = props.agreement.billingUnitType === "HOUR" ? "時間" : "人工";
    return {
      unitPriceBase:
        formatCurrency(props.agreement.unitPriceBase) + " / " + unit,
      overTimeUnitPriceBase:
        formatCurrency(props.agreement.overtimeUnitPriceBase) + " / " + "時間",
      unitPriceQualified:
        formatCurrency(props.agreement.unitPriceQualified) + " / " + unit,
      overTimeUnitPriceQualified:
        formatCurrency(props.agreement.overtimeUnitPriceQualified) +
        " / " +
        "時間",
    };
  });
  return {
    label,
    dayType: Vue.computed(() => props.agreement.dayType),
    shiftType: Vue.computed(() => props.agreement.shiftType),
    formatted,
  };
}
