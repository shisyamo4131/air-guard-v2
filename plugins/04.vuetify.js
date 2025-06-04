// import this after install `@mdi/font` package
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";

// --- for using `VDateInput` ---
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
    components: {
      VDateInput,
    },
    /** ロケールを ja 優先に設定 */
    locale: {
      locale: "ja",
      fallback: "en",
      messages: { ja, en },
    },
    defaults: {
      VDataTable: {
        VIcon: {
          color: "medium-emphasis",
          size: "small",
        },
      },
    },
  });
  app.vueApp.use(vuetify);
});
