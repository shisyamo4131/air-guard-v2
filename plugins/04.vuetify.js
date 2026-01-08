import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";
import { VDateInput } from "vuetify/labs/VDateInput";

/**
 * Vuetify ^3.10.0 で必要なインポート
 * - v-resize ディレクティブが VCalendar が更新されたタイミングで必要になったようだ。
 *   - 'Failed to resolve directive: resize' の警告が出た。
 * - Nuxt 向けの Vuetify モジュール/設定ではデフォルトで Vuetify のディレクティブを登録しない設定になっている。
 *   自身で必要なディレクティブをインポートして登録する必要がある。
 * 参考: https://vuetifyjs.com/en/getting-started/installation/?utm_source=chatgpt.com#existing-projects
 */
import * as directives from "vuetify/directives";

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
    display: {
      mobileBreakpoint: "sm",
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
      VAlert: {
        // class: "pt-4 pb-3 px-3 text-body-2",
        variant: "tonal",
        border: "start",
        // prominent: true,
      },
      VBtn: {
        variant: "flat",
      },
      /**
       * VCalendar Defaults
       * https://vuetifyjs.com/en/components/calendars/#calendars
       * - dayFormat: customize the format of the day labels
       * - first-day-of-week: 0 (Sunday) to 6 (Saturday)
       * - hide-week-number: whether to hide the week number column
       *
       * NOTE: v.3.11.6 では `monthFormat` の既定値設定がうまく動作しない不具合があるようだ。
       */
      VCalendar: {
        dayFormat: ({ day }) => day,
        firstDayOfWeek: 0, // 0: Sunday, 1: Monday, ...
        hideWeekNumber: true,
      },
      VCard: {
        border: true,
        flat: true,
      },
      VTimePicker: {
        allowedMinutes: (val) => val % 10 === 0,
        color: "primary",
        format: "ampm",
      },
      AirDataTable: {
        VToolbar: {
          color: "primary",
        },
      },
      AtomsBillingUnitTypeChip: {
        VChip: { density: "compact", size: "small" },
      },
      AtomsDayTypeChip: {
        VChip: { density: "compact", size: "small" },
      },
      AtomsQualifiedTypeChip: {
        VChip: {
          density: "compact",
          label: true,
          size: "small",
          variant: "flat",
        },
      },
      AtomsShiftTypeChip: {
        VChip: { density: "compact", size: "small" },
      },
    },
  });
  app.vueApp.use(vuetify);

  return {
    provide: { vuetify },
  };
});
