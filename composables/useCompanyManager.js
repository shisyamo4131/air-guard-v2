/*****************************************************************************
 * useCompanyManager
 * @version 1.0.0
 * @description A composable to manage company information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useDocManager } from "@/composables/useDocManager";
import { RoundSetting } from "@/schemas";

/**
 * @returns {Object} - Company manager attributes and information.
 * @returns {Object} attrs - Attributes for the item manager component.
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {Object} info.settings - Settings information about the company.
 */
export function useCompanyManager() {
  const { company } = useAuthStore();
  const docManager = useDocManager("useCompanyManager", {
    doc: company,
  });

  /** METHODS (PRIVATE) */
  const _handleCreate = () => {
    throw new Error("Creation is not implemented");
  };

  const _handleDelete = () => {
    throw new Error("Deletion is not implemented");
  };

  /** COMPUTED PROPERTIES */
  // Attributes for the item manager
  const attrs = Vue.computed(() => {
    return {
      ...docManager.attrs.value,
      handleCreate: _handleCreate,
      handleDelete: _handleDelete,
      disableDelete: true,
      hideDeleteBtn: true,
    };
  });

  // An array of input configurations for the company manager form
  const inputs = Vue.computed(() => {
    const base = {
      excludedKeys: ["agreements", "minuteInterval", "roundSetting"],
    };
    const settings = {
      includedKeys: ["minuteInterval", "roundSetting"],
    };
    return { base, settings };
  });

  // An array of information for the information-card component
  const info = Vue.computed(() => {
    const bankInfo = company.hasBankInfo
      ? `${company.bankName} ${company.branchName} f${company.accountType} ${company.accountNumber}`
      : "未設定";
    // Base information
    const base = [
      {
        title: "会社名",
        props: {
          subtitle: `${company.companyName}`,
          prependIcon: "mdi-tag",
        },
      },
      {
        title: "住所",
        props: {
          subtitle: `${company.zipcode} ${company.fullAddress}`,
          prependIcon: "mdi-map-marker",
          lines: "two",
        },
      },
      {
        title: "建物",
        props: {
          subtitle: company.building || "-",
          prependIcon: "mdi-office-building-marker",
        },
      },
      {
        title: "電話番号",
        props: {
          subtitle: company.tel || "-",
          prependIcon: "mdi-phone",
        },
      },
      {
        title: "FAX番号",
        props: {
          subtitle: company.fax || "-",
          prependIcon: "mdi-fax",
        },
      },
      {
        title: "振込先情報",
        props: {
          subtitle: bankInfo,
          prependIcon: "mdi-fax",
        },
      },
    ];

    // Settings information
    const settings = [
      {
        title: "時刻選択間隔（分）",
        props: {
          subtitle: `${company.minuteInterval} 分`,
          prependIcon: "mdi-timer-sand",
        },
      },
      {
        title: "端数処理",
        props: {
          subtitle: RoundSetting.label(company.roundSetting),
          prependIcon: "mdi-calculator-variant-outline",
        },
      },
    ];
    return { base, settings };
  });

  /***************************************************************************
   * RETURN OBJECTS
   ***************************************************************************/
  return { ...docManager, attrs, info, inputs };
}
