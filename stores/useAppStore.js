import * as Vue from "vue";
import { useDisplay } from "vuetify";
import { useAuthStore } from "./useAuthStore";
import { useRoute, useRouter } from "vue-router";
import { getPageConfig, hasParentPage } from "@/utils/pageSettings";

const APP_NAME = "AirGuard";

export const useAppStore = defineStore("app", () => {
  const display = useDisplay();
  const auth = useAuthStore();
  const route = useRoute();
  const router = useRouter();

  /***************************************************************************
   * SETUP REACTIVE VARIABLES
   ***************************************************************************/
  /**
   * A Navigation drawer state
   * - Syncronized with Vuetify's display.lgAndUp
   */
  const drawer = Vue.ref(false); // for Navigation drawer
  Vue.watchEffect(() => (drawer.value = display.lgAndUp.value));

  /**
   * A Navigation bar's attribute computed properties
   */
  const navBar = Vue.computed(() => {
    return {
      app: true,
      modelValue: drawer.value,
      permanent: display.lgAndUp.value,
      temporary: !display.lgAndUp.value,
      toggle: () => (drawer.value = !drawer.value),
      "onUpdate:modelValue": (value) => (drawer.value = value),
    };
  });

  const appTitle = Vue.computed(() => {
    const pageConfig = getPageConfig(route.path);
    if (!pageConfig) return APP_NAME;
    return pageConfig?.label || APP_NAME;
  });

  /**
   * An App bar's attribute computed properties
   */
  const appBar = Vue.computed(() => {
    return {
      app: true,
      color: "primary",
      dark: true,
      flat: true,
      title: appTitle.value,
    };
  });

  /**
   * An icon's attribute for navigation drawer toggle computed properties
   */
  const navIcon = Vue.computed(() => {
    return {
      class: { "d-none": !auth.uid || display.lgAndUp.value },
      onClick: () => (drawer.value = !drawer.value),
    };
  });

  const previousButton = Vue.computed(() => {
    return {
      class: { "d-none": !hasParentPage(route.path) },
      icon: "mdi-chevron-left",
      onClick: () => router.go(-1),
    };
  });

  return {
    appBar,
    navBar,
    navIcon,
    previousButton,
  };
});
