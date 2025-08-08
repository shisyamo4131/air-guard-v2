<script setup>
/**
 * @file components/arrangements/Table.vue
 * @description A table component for displaying arrangements.
 * It generates a table structure with headers, body, and footers based on the provided information.
 *
 * @props {Array} siteOrder - Array of site orders to display in the table.
 * `siteId` and `shiftType` are expected in each object.
 * @props {Date|String} from - Start date for the table, used to generate date columns.
 * @props {Number} dayCount - Number of days to display in the table.
 *
 * @slots
 * header-cell - Slot for customizing the header cell content.
 * body-row - Slot for replacing the entire row. Contains site information and all cells for the row.
 * site-row - Slot for customizing the site row content.
 * body-cell - Slot for customizing the body cell content.
 * footer-cell - Slot for customizing the footer cell content.
 */
import dayjs from "dayjs";
import { useDateUtil } from "@/composables/useDateUtil";

/** define props */
const props = defineProps({
  siteOrder: { type: Array, default: () => [] },
  from: { type: [Date, String], default: () => new Date() },
  dayCount: { type: Number, default: 1 },
});

/** define composables */
const { getDayInfo } = useDateUtil();

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
 *     dateLabel: "8/8",
 *     dayOfWeekJp: "金",
 *     cssClasses: { "g-col": true, "g-col-fri": true, "g-col-today": true }
 *   },
 *   {
 *     date: "2025-08-09",
 *     dayOfWeek: "sat",
 *     isHoliday: false,
 *     dateLabel: "8/9",
 *     dayOfWeekJp: "土",
 *     cssClasses: { "g-col": true, "g-col-sat": true, "g-col-future": true }
 *   },
 *   {
 *     date: "2025-08-10",
 *     dayOfWeek: "sun",
 *     isHoliday: false,
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
      ...getDayInfo(dateAt),
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
 *           dateLabel: "8/9",
 *           dayOfWeekJp: "土",
 *           cssClasses: { "g-col": true, "g-col-sat": true, "g-col-future": true }
 *         }
 *       }
 *     ]
 *   }
 * ]
 */
const matrix = computed(() => {
  return props.siteOrder.map(({ siteId, shiftType }) => {
    // Generate cell information corresponding to each date
    const cells = columns.value.map((column) => {
      return {
        key: `${siteId}-${shiftType}-${column.date}`, // Unique key
        siteId,
        shiftType,
        date: column.date,
        dayInfo: column, // Date information (day of week, holiday check, CSS classes, etc.)
      };
    });
    return {
      key: `${siteId}-${shiftType}`, // Unique key for the row
      siteId,
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
            { date, dayOfWeekJp, isHoliday, dateLabel, dayOfWeekJp, cssClasses }
          -->
          <slot name="header-cell" v-bind="col">
            <AtomsIconsHolidayFlag v-if="col.isHoliday" class="mr-1" />
            <span>{{ `${col.dateLabel}(${col.dayOfWeekJp})` }}</span>
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
                { key, siteId, shiftType, cells }
              -->
                <slot name="site-row" v-bind="order" />
              </div>
            </td>
          </tr>
          <tr class="g-row g-row-no-hover">
            <td
              v-for="cell of order.cells"
              :key="cell.key"
              :class="cell.dayInfo.cssClasses"
            >
              <!--
              body-cell slot
              For displaying the body cell content.
              { key, siteId, shiftType, date, dayInfo }
            -->
              <slot name="body-cell" v-bind="cell" />
            </td>
          </tr>
        </slot>
      </template>
    </tbody>
    <tfoot>
      <tr>
        <th v-for="col of columns" :key="col.date" :class="col.cssClasses">
          <!--
            footer-cell slot
            For displaying footer cell content.
            { date, dayOfWeekJp, isHoliday, dateLabel, dayOfWeekJp, cssClasses }
          -->
          <slot name="footer-cell" v-bind="col" />
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

/* テーブルヘッダーのスタイル */
#arrangement-table > div > table > thead > tr > th {
  text-align: center;
  min-width: 264px;
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

/* セルホバー時のデフォルト背景色 */
.g-col:hover {
  background-color: #e0e0e0;
}

/* 土曜セルの背景色 */
.g-col.g-col-sat {
  background-color: #e3f2fd !important;
}

/* 土曜セルのホバー時背景色 */
.g-col.g-col-sat:hover {
  background-color: #bbdefb !important;
}

/* 日曜・祝日セルの背景色 */
.g-col.g-col-sun,
.g-col.g-col-holiday {
  background-color: #ffebee !important;
}

/* 日曜・祝日セルのホバー時背景色 */
.g-col.g-col-sun:hover,
.g-col.g-col-holiday:hover {
  background-color: #ffcdd2 !important;
}

/* 当日セルの背景色 */
.g-col.g-col-today {
  background-color: #fffde7 !important;
}

/* 当日セルのホバー時背景色 */
.g-col.g-col-today:hover {
  background-color: #fff9c4 !important;
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
  left: 16px;
  z-index: 1 !important;
}
</style>
