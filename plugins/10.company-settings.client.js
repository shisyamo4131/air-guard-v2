/*****************************************************************************
 * @file ./plugins/10.company-settings.client.js
 * @description 会社ごとのコンポーネントに対する既定値を設定する Nuxt プラグイン
 *****************************************************************************/
import * as Vue from "vue";
import { useComponentDefaults } from "@/composables/useComponentDefaults";
import { RoundSetting } from "@/schemas";
import { useCompanyStore } from "@/stores/useCompanyStore";

export default defineNuxtPlugin(() => {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const companyStore = useCompanyStore();
  const { set } = useComponentDefaults();

  /***************************************************************************
   * WATCHERS
   ***************************************************************************/
  /**
   * Watches `companyInstance` and updates vuetify's global settings accordingly.
   * @update 2026-01-07 - Added `firstDayOfWeek` setting for `VCalendar`.
   */
  Vue.watchEffect(() => {
    // Set allowed minutes for VTimePicker based on company settings
    set("VTimePicker", companyStore.company?.minuteInterval);

    // Update `RoundSetting` global setting based on company settings
    RoundSetting.set(
      companyStore.company?.roundSetting || RoundSetting.ROUND,
    );

    // Update `firstDayOfWeek` for `VCalendar` based on company settings
    set("VCalendar", companyStore.company?.firstDayOfWeek || 0);
  });
});
