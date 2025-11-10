/*****************************************************************************
 * useCompanyManager
 * @version 1.0.0
 * @description A composable to manage company information.
 * @author shisyamo4131
 *****************************************************************************/
import * as Vue from "vue";
import { RoundSetting } from "@/schemas";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useLogger } from "../composables/useLogger";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * @returns {Object} - Company manager attributes and information.
 * @returns {Object} attrs - Attributes for the item manager component.
 * @returns {Object} info - Information for the information-card component.
 * @returns {Object} info.base - Base information about the company.
 * @returns {Object} info.settings - Settings information about the company.
 */
export function useCompanyManager() {
  /***************************************************************************
   * SETUP STORES & COMPOSABLES
   ***************************************************************************/
  const logger = useLogger("CompanyManager", useErrorsStore());
  const { company } = useAuthStore();

  /***************************************************************************
   * METHODS (PRIVATE)
   ***************************************************************************/
  function handleCreate() {
    const error = new Error("Creation is not implemented");
    logger.error({ error });
  }

  async function handleUpdate(item) {
    await item.update(item);
  }

  function handleDelete() {
    const error = new Error("Deletion is not implemented");
    logger.error({ error });
  }

  /***************************************************************************
   * COMPUTED PROPERTIES
   ***************************************************************************/
  /** Attributes for the item manager */
  const attrs = Vue.computed(() => {
    return {
      modelValue: company,
      handleCreate,
      handleUpdate,
      handleDelete,
      disableDelete: true,
      hideDeleteBtn: true,
      onError: (e) => logger.error({ error: e }),
      "onError:clear": () => logger.clearError(),
    };
  });

  /** Information for the `information-card` */
  const info = Vue.computed(() => {
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
  return { attrs, info };
}
