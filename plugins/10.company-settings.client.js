/*****************************************************************************
 * @file ./plugins/10.company-settings.client.js
 * @description 会社ごとのコンポーネントに対する既定値を設定する Nuxt プラグイン
 *****************************************************************************/
import * as Vue from "vue";
import { useComponentDefaults } from "@/composables/useComponentDefaults";
import { RoundSetting } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

export default defineNuxtPlugin(() => {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const auth = useAuthStore();
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
    set("VTimePicker", auth.company?.minuteInterval);

    // Update `RoundSetting` global setting based on company settings
    RoundSetting.set(auth.company?.roundSetting || RoundSetting.ROUND);

    // Update `firstDayOfWeek` for `VCalendar` based on company settings
    set("VCalendar", auth.company?.firstDayOfWeek || 0);
  });
});
