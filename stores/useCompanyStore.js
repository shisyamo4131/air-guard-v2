/*****************************************************************************
 * @file ./stores/useCompanyStore.js
 * @description 現在の会社情報を管理するストア
 *****************************************************************************/
import { reactive } from "vue";
import { Company } from "@/schemas";

export const useCompanyStore = defineStore("company", () => {
  const companyInstance = reactive(new Company());

  return {
    company: companyInstance,
  };
});
