// import this after install `@mdi/font` package
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";

// --- for using `VCalendar` ---
import { VCalendar } from "vuetify/labs/VCalendar";

// --- for using `VDateInput` ---
import { VDateInput } from "vuetify/labs/VDateInput";

// --- for using `VTimePicker` ---
// import { VTimePicker } from "vuetify/labs/VTimePicker";

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
      // VTimePicker,
    },
    /** ロケールを ja 優先に設定 */
    locale: {
      locale: "ja",
      fallback: "en",
      messages: { ja, en },
    },
    defaults: {
      VToolbar: {
        VIcon: {
          color: "medium-emphasis",
          size: "small",
        },
      },
      VDataTable: {
        VIcon: {
          color: "medium-emphasis",
          size: "small",
        },
      },
      VCalendar: {
        hideWeekNumber: true,
      },
    },
  });
  app.vueApp.use(vuetify);
});
