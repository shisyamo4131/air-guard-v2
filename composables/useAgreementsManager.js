/*****************************************************************************
 * useAgreementsManager
 * @version 1.0.0
 * @description A composable to manage agreements information.
 * @author shisyamo4131
 *****************************************************************************/

import * as Vue from "vue";
import { Agreement, CutoffDate } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @param {Object} instance - The instance containing agreements.
 * @param {Object} options - Options for the agreements manager.
 * @param {boolean} options.useDefault - Whether to include company agreements as selectable items.
 * @returns {Object} - Agreements manager attributes.
 * @returns {Object} attrs - Attributes for the agreements manager component.
 */
export function useAgreementsManager(instance, options = {}) {
  const { useDefault = false } = options;

  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("AgreementsManager", useErrorsStore());
  const { company } = useAuthStore();

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  const selectableItems = Vue.computed(() => {
    const companyAgreements = company.agreements || [];
    if (useDefault) {
      return [...companyAgreements, ...instance.agreements];
    } else {
      return [...instance.agreements];
    }
  });

  /** Attributes for the manager component */
  const attrs = Vue.computed(() => {
    return {
      modelValue: instance.agreements,
      schema: Agreement,
      errorMessages: {
        duplicateKey: "既に登録されている取極めです。",
      },
      itemKey: "key",
      selectableItems: selectableItems.value,
      tableProps: {
        headers: [
          {
            title: "適用開始日",
            key: "dateAt",
            value: (item) => item.dateAt.toLocaleDateString(),
          },
          {
            title: "締日",
            key: "cutoffDate",
            value: (item) => {
              return CutoffDate.getDisplayText(item.cutoffDate);
            },
            align: "center",
            sortable: false,
          },
          {
            title: "区分",
            key: "type",
            value: (item) =>
              `${Agreement.DAY_TYPE[item.dayType].title}${
                Agreement.SHIFT_TYPE[item.shiftType].title
              }`,
            align: "center",
            sortable: false,
          },
          {
            title: "勤務時間",
            key: "time",
            value: (item) => `${item.startTime} ～ ${item.endTime}`,
            align: "center",
            sortable: false,
          },
          {
            title: "規定実働時間",
            key: "regulationWorkMinutes",
            value: (item) => `${item.regulationWorkMinutes}分`,
            align: "center",
            sortable: false,
          },
          {
            title: "休憩時間",
            key: "breakMinutes",
            value: (item) => `${item.breakMinutes}分`,
            align: "center",
            sortable: false,
          },
          {
            title: "残業時間",
            key: "overtimeWorkMinutes",
            value: (item) => `${item.overtimeWorkMinutes}分`,
            align: "center",
            sortable: false,
          },
          {
            title: "通常",
            align: "center",
            children: [
              {
                title: "単価",
                key: "unitPriceBase",
                value: (item) => item.unitPriceBase.toLocaleString(),
                align: "center",
                sortable: false,
              },
              {
                title: "時間外",
                key: "overtimeUnitPriceBase",
                value: (item) => item.overtimeUnitPriceBase.toLocaleString(),
                align: "center",
                sortable: false,
              },
            ],
          },
          {
            title: "資格者",
            align: "center",
            children: [
              {
                title: "単価",
                key: "unitPriceQualified",
                value: (item) => item.unitPriceQualified.toLocaleString(),
                align: "center",
                sortable: false,
              },
              {
                title: "時間外",
                key: "overtimeUnitPriceQualified",
                value: (item) =>
                  item.overtimeUnitPriceQualified.toLocaleString(),
                align: "center",
                sortable: false,
              },
            ],
          },
          {
            title: "請求単位",
            key: "billingUnitType",
            value: (item) =>
              Agreement.BILLING_UNIT_TYPE[item.billingUnitType].title,
            align: "center",
            sortable: false,
          },
        ],
        hideDefaultFooter: true,
        hideSearch: true,
        itemsPerPage: -1,
        sortBy: [{ key: "dateAt", order: "desc" }],
      },
      "onUpdate:modelValue": (value) => (instance.agreements = value),
      "onSubmit:complete": () => instance.update(),
      onError: (e) => logger.error({ error: e }),
      "onError:clear": () => logger.clearError(),
    };
  });

  return { attrs };
}
