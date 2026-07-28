/*****************************************************************************
 * @file ./plugins/11.user-settings.client.js
 * @description ユーザーごとのコンポーネントに対する既定値を設定する Nuxt プラグイン
 *****************************************************************************/
import * as Vue from "vue";
import { TAG_SIZE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useComponentDefaults } from "@/composables/useComponentDefaults";
import { useAuthStore } from "@/stores/useAuthStore";

export default defineNuxtPlugin(() => {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const auth = useAuthStore();
  const { set } = useComponentDefaults();

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  Vue.watch(
    () => auth.user.tagSize,
    (tagSize) => {
      if (tagSize && TAG_SIZE_VALUES[tagSize]) set("Tag", tagSize);
    },
    { immediate: true },
  );
});
