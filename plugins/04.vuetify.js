// import this after install `@mdi/font` package
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";

/**
 * Vuetify ^3.10.0 で必要なインポート
 * - v-resize ディレクティブが VCalendar が更新されたタイミングで必要になったようだ。
 *   - 'Failed to resolve directive: resize' の警告が出た。
 * - Nuxt 向けの Vuetify モジュール/設定ではデフォルトで Vuetify のディレクティブを登録しない設定になっている。
 *   自身で必要なディレクティブをインポートして登録する必要がある。
 * 参考: https://vuetifyjs.com/en/getting-started/installation/?utm_source=chatgpt.com#existing-projects
 */
import * as directives from "vuetify/directives";

// --- for using `VCalendar` and `VDateInput` ---
import { VCalendar } from "vuetify/labs/VCalendar";
import { VDateInput } from "vuetify/labs/VDateInput";

// --- for setup Internationalization ---
import { ja, en } from "vuetify/locale";

/**
 * VDateInput
 * https://vuetifyjs.com/en/components/date-inputs/#date-inputs
 *
 * - Internationalization (i18n)
 * https://vuetifyjs.com/en/features/internationalization/#getting-started
 *
 * - VDateInput and VLocaleProvider sample
 * https://note.shiftinc.jp/n/nea577fc550c3
 */
export default defineNuxtPlugin((app) => {
  const vuetify = createVuetify({
    display: {
      mobileBreakpoint: "sm",
    },
    components: {
      VCalendar,
      VDateInput,
    },
    directives,
    /** ロケールを ja 優先に設定 */
    locale: {
      locale: "ja",
      fallback: "en",
      messages: { ja, en },
    },
    /**
     * Set default props for Vuetify components
     * https://vuetifyjs.com/en/features/global-configuration/#global-configuration
     */
    defaults: {
      VCalendar: {
        hideWeekNumber: true,
      },
      VDataTable: {
        VIcon: {
          color: "medium-emphasis",
          size: "small",
        },
      },
      VTimePicker: {
        allowedMinutes: (val) => val % 10 === 0,
        color: "primary",
        format: "ampm",
      },
      VToolbar: {
        VIcon: {
          color: "medium-emphasis",
          size: "small",
        },
      },
    },
  });
  app.vueApp.use(vuetify);

  return {
    provide: { vuetify },
  };
});
