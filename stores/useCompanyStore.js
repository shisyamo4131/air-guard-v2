/*****************************************************************************
 * @file ./stores/useCompanyStore.js
 * @description 現在の会社情報を管理するストア
 *****************************************************************************/
import { computed, reactive } from "vue";
import { Company } from "@/schemas";
import { getCustomerType } from "@/utils/subscription/getCustomerType";

export const useCompanyStore = defineStore("company", () => {
  const companyInstance = reactive(new Company());

  const customerType = computed(() =>
    getCustomerType(companyInstance.subscription),
  );

  return {
    company: companyInstance,
    customerType,
  };
});
