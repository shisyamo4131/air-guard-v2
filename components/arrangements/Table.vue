<script setup>
/**
 * @file components/arrangements/Table.vue
 * @description A table component for displaying arrangements.
 * It generates a table structure with headers, body, and footers based on the provided information.
 *
 * @prop {Number} dayCount - Number of days to display in the table.
 * @prop {Date|String} from - Start date for the table, used to generate date columns.
 * @prop {Object} modelValue - An object mapping site and shift type to arrays of `SiteOperationSchedule` instances.
 * @prop {Object} notifications - An object containing arrangement notifications.
 * @prop {String} selectedDate - Currently selected date, used for highlighting.
 * @prop {Array} siteOrder - Array of site orders to display in the table.
 * `siteId` and `shiftType` are expected in each object.
 * @prop {Object} statistics - An object containing statistics data, such as required personnel counts.
 *
 * @emits {Event} update:selected-date - Emitted when the selected date is updated.
 * @emits {Event} click:output-sheet - Emitted when the output sheet button is clicked for a date.
 * @emits {Event} click:command - Emitted when the command button is clicked for a date.
 * @emits {Event} update:model-value - Emitted when the model value is updated.
 * @emits {Event} change:workers - Emitted when the order of workers changes.
 * @emits {Event} click:duplicate - Emitted when the duplicate button is clicked for a date.
 * @emits {Event} click:edit - Emitted when the edit button is clicked for a date.
 * @emits {Event} click:edit-worker - Emitted when the edit button is clicked on a worker tag.
 * @emits {Event} click:edit-workers - Emitted when the `account-edit` button is clicked.
 * @emits {Event} click:notify - Emitted when the notify button is clicked for a date.
 * @emits {Event} click:notification - Emitted when the notification chip is clicked for a date.
 * @emits {Event} click:add-schedule - Emitted when the add schedule button is clicked for a site and shift type.
 * @emits {Event} click:hide - Emitted when the hide button is clicked for a site and shift type.
 *
 * @deprecated
 * @emits {Event} click:remove-worker - Emitted when the remove button is clicked on a worker tag.
 *
 * @slots
 * header-cell - Slot for customizing the header cell content.
 * body-row - Slot for replacing the entire row. Contains site information and all cells for the row.
 */
import dayjs from "dayjs";
import { useDateUtil } from "@/composables/useDateUtil";

/** define props */
const props = defineProps({
  dayCount: { type: Number, default: 1 },
  from: { type: [Date, String], default: () => new Date() },
  modelValue: { type: Object, default: () => ({}) },
  notifications: { type: Object, default: () => ({}) },
  selectedDate: { type: String, default: null },
  siteOrder: { type: Array, default: () => [] },
  statistics: { type: Object, default: () => ({}) },
});

/** define emits */
const emit = defineEmits([
  "update:selected-date",
  "click:output-sheet",
  "click:command",
  "update:model-value",
  "change:workers",
  "click:duplicate",
  "click:edit",
  "click:edit-worker",
  "click:edit-workers",
  "click:notify",
  "click:notification",
  // "click:remove-worker",  // Deprecated 2025-12-24
  "click:add-schedule",
  "click:hide",
]);

/** define composables */
const { getDayInfo } = useDateUtil();

/** define refs */
const selectedDates = ref([]); // 選択された日付の配列（v-btn-toggle のバインドに型を合わせる）

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.selectedDate,
  (newVal) => {
    selectedDates.value = newVal ? [newVal] : [];
  },
  { immediate: true }
);

watch(
  selectedDates,
  (newVal) => {
    emit("update:selected-date", newVal[0] || null);
  },
  { deep: true }
);

/**
 * Generate column data structure for table header
 * Creates column information for each date in the specified range
 *
 * @example
 * // Sample output when from = "2025-08-08" and dayCount = 3:
 * [
 *   {
 *     date: "2025-08-08",
 *     dayOfWeek: "fri",
 *     isHoliday: false,
 *     isSelected: false,
 *     dateLabel: "8/8",
 *     dayOfWeekJp: "金",
 *     cssClasses: { "g-col": true, "g-col-fri": true, "g-col-today": true }
 *   },
 *   {
 *     date: "2025-08-09",
 *     dayOfWeek: "sat",
 *     isHoliday: false,
 *     isSelected: true,
 *     dateLabel: "8/9",
 *     dayOfWeekJp: "土",
 *     cssClasses: { "g-col": true, "g-col-sat": true, "g-col-future": true, "g-col-selected": true }
 *   },
 *   {
 *     date: "2025-08-10",
 *     dayOfWeek: "sun",
 *     isHoliday: false,
 *     isSelected: false,
 *     dateLabel: "8/10",
 *     dayOfWeekJp: "日",
 *     cssClasses: { "g-col": true, "g-col-sun": true, "g-col-future": true }
 *   }
 * ]
 */
const columns = computed(() => {
  let result = [];
  const from = dayjs(props.from);
  for (let i = 0; i < props.dayCount; i++) {
    const dateAt = from.add(i, "day");
    const date = dateAt.format("YYYY-MM-DD");
    result.push({
      date,
      ...getDayInfo({ date: dateAt, selectedDates: selectedDates.value }),
    });
  }
  return result;
});

/**
 * Generate table row and cell data structure
 * Creates row data containing cell information for all periods for each site and shift type
 *
 * @example
 * // Sample output when siteOrder = [{siteId: "A001", shiftType: "day"}] and dayCount = 2:
 * [
 *   {
 *     key: "A001-day",
 *     siteId: "A001",
 *     shiftType: "day",
 *     cells: [
 *       {
 *         key: "A001-day-2025-08-08",
 *         siteId: "A001",
 *         shiftType: "day",
 *         date: "2025-08-08",
 *         dayInfo: {
 *           date: "2025-08-08",
 *           dayOfWeek: "fri",
 *           isHoliday: false,
 *           isSelected: false,
 *           dateLabel: "8/8",
 *           dayOfWeekJp: "金",
 *           cssClasses: { "g-col": true, "g-col-fri": true, "g-col-today": true }
 *         }
 *       },
 *       {
 *         key: "A001-day-2025-08-09",
 *         siteId: "A001",
 *         shiftType: "day",
 *         date: "2025-08-09",
 *         dayInfo: {
 *           date: "2025-08-09",
 *           dayOfWeek: "sat",
 *           isHoliday: false,
 *           isSelected: true,
 *           dateLabel: "8/9",
 *           dayOfWeekJp: "土",
 *           cssClasses: { "g-col": true, "g-col-sat": true, "g-col-future": true, "g-col-selected": true }
 *         }
 *       }
 *     ]
 *   }
 * ]
 */
const matrix = computed(() => {
  return props.siteOrder.map(({ siteId, siteName, shiftType }) => {
    // Generate cell information corresponding to each date
    const cells = columns.value.map((column) => {
      return {
        key: `${siteId}-${shiftType}-${column.date}`, // Unique key
        siteId,
        siteName,
        shiftType,
        date: column.date,
        dayInfo: column, // Date information (day of week, holiday check, CSS classes, selection state, etc.)
      };
    });
    return {
      key: `${siteId}-${shiftType}`, // Unique key for the row
      siteId,
      siteName,
      shiftType,
      cells, // Array of all cells included in this row
    };
  });
});
</script>

<template>
  <v-table id="arrangement-table" fixed-header>
    <thead>
      <tr>
        <th v-for="col of columns" :key="col.date" :class="col.cssClasses">
          <!--
            header-cell slot
            For displaying date information in the header cell.
            { date, dayOfWeek, isHoliday, isSelected, dateLabel, dayOfWeekJp, cssClasses }
          -->
          <slot name="header-cell" v-bind="col">
            <div class="d-flex align-center justify-center" style="gap: 8px">
              <v-btn-toggle
                v-model="selectedDates"
                color="info"
                multiple
                density="compact"
                variant="text"
              >
                <v-btn :value="col.date">
                  <AtomsIconsHolidayFlag v-if="col.isHoliday" class="mr-1" />
                  {{ `${col.dateLabel}(${col.dayOfWeekJp})` }}
                </v-btn>
              </v-btn-toggle>
              <v-btn
                icon="mdi-table-large"
                size="x-small"
                @click="emit('click:output-sheet', col.date)"
              />
              <v-btn
                icon="mdi-text-box-outline"
                size="x-small"
                @click="emit('click:command', col.date)"
              />
            </div>
          </slot>
        </th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(order, index) of matrix" :key="`site-row-${index}`">
        <!--
          body-row slot
          For replacing the entire row. Contains site information and all cells for the row.
          Root element must be `<tr>` if using this slot.
          { key, siteId, shiftType, cells }
        -->
        <slot name="body-row" v-bind="order">
          <tr>
            <td class="site-row" :colspan="columns.length">
              <div class="fixed-left">
                <!--
                  site-row slot
                  For displaying site information in the row header.
                  { key, siteId, siteName, shiftType, cells }
                -->
                <div v-if="order.siteName" class="text-subtitle-1">
                  <div class="d-flex align-center">
                    <v-btn
                      icon="mdi-plus"
                      @click="
                        emit('click:add-schedule', {
                          siteId: order.siteId,
                          shiftType: order.shiftType,
                        })
                      "
                      size="x-small"
                      variant="tonal"
                    />
                    <v-btn
                      icon="mdi-eye-off"
                      @click="
                        emit('click:hide', {
                          siteId: order.siteId,
                          shiftType: order.shiftType,
                        })
                      "
                      size="x-small"
                      variant="tonal"
                    />
                    <AtomsChipsShiftType
                      class="mr-2"
                      :shift-type="order.shiftType"
                    />
                    <span>{{ order.siteName }}</span>
                  </div>
                </div>
                <v-progress-circular v-else indeterminate size="small" />
              </div>
            </td>
          </tr>
          <tr class="g-row g-row-no-hover">
            <td
              v-for="cell of order.cells"
              :key="cell.key"
              :class="cell.dayInfo.cssClasses"
            >
              <ArrangementsDraggableSchedules
                :model-value="modelValue[cell.key] || []"
                :notifications="notifications"
                :site-id="cell.siteId"
                :shift-type="cell.shiftType"
                @update:model-value="
                  emit('update:model-value', {
                    newSchedules: $event,
                    groupKey: cell.key,
                  })
                "
                @change:workers="emit('change:workers', $event)"
                @click:duplicate="emit('click:duplicate', $event)"
                @click:edit="emit('click:edit', $event)"
                @click:edit-worker="emit('click:edit-worker', $event)"
                @click:edit-workers="emit('click:edit-workers', $event)"
                @click:notify="emit('click:notify', $event)"
                @click:notification="emit('click:notification', $event)"
              >
              </ArrangementsDraggableSchedules>
            </td>
          </tr>
        </slot>
      </template>
    </tbody>
    <tfoot>
      <tr>
        <th v-for="col of columns" :key="col.date" :class="col.cssClasses">
          <span class="text-subtitle-2">
            {{ `稼働数: ${statistics?.requiredPersonnel?.[col.date] || 0}` }}
          </span>
        </th>
      </tr>
    </tfoot>
  </v-table>
</template>

<style scoped>
/* v-tableのスタイル */
#arrangement-table {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

/* fixed テーブルに */
#arrangement-table > div > table {
  table-layout: fixed;
}

/* セル幅を固定 */
#arrangement-table th,
#arrangement-table td {
  width: 264px;
  min-width: 264px;
  max-width: 264px;
}

/* テーブルヘッダーのスタイル */
#arrangement-table > div > table > thead > tr > th {
  text-align: center;
  border: 1px solid grey;
}

/* テーブルヘッダーのスタイル */
#arrangement-table > div > table > tbody > tr > td {
  padding: 0px;
  border: 1px solid grey;
}

/* テーブルフッターのスタイル */
#arrangement-table tfoot {
  position: sticky;
  bottom: 0;
  z-index: 1;
}

#arrangement-table tfoot th {
  background: #fff;
  text-align: center;
  border: 1px solid grey;
}

/* 行のホバー時協調表示解除 */
tr.g-row.g-row-no-hover:hover {
  background-color: transparent !important;
}

/* 土曜セルの背景色 */
.g-col.g-col-sat {
  background-color: #e3f2fd !important;
}

/* 日曜・祝日セルの背景色 */
.g-col.g-col-sun,
.g-col.g-col-holiday {
  background-color: #ffebee !important;
}

/* 当日セルの背景色 */
.g-col.g-col-today {
  background-color: #fffde7 !important;
}

/* 過去日付セルの背景色 */
.g-col.g-col-previous {
  background-color: #e0e0e0 !important;
}

.site-row {
  background-color: beige;
}
/* 現場名を左側に固定してスクロールしても動かないようにする */
.fixed-left {
  display: inline-block;
  position: sticky;
  left: 4px;
  z-index: 1 !important;
}

/* 選択中の列を強調 */
.g-col-selected {
  box-shadow: inset 0 0 0 4px #1976d2 !important;
}
</style>
