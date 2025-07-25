<script setup>
import dayjs from "dayjs";
import { getDayType } from "air-guard-v2-schemas/constants";

/**
 * ArrangementsScheduleTable - スケジュール管理テーブルコンポーネント
 */

const props = defineProps({
  schedules: { type: Array, required: true },
  cachedEmployees: { type: Object, default: () => ({}) },
  cachedOutsourcers: { type: Object, default: () => ({}) },
  dayCount: { type: Number, default: 7 },
});

const today = new Date();

/**
 * Generate columns based on dayCount
 */
const columns = computed(() => {
  const startDate = dayjs().locale("en");
  const result = [];

  for (let i = 0; i < props.dayCount; i++) {
    const date = startDate.add(i, "day");
    result.push({
      date: date.format("YYYY-MM-DD"),
      dateAt: date.toDate(),
      col: date.format("MM/DD"),
      dayOfWeek: date.format("ddd").toLowerCase(),
      isHoliday: getDayType(date.toDate()) === "holiday",
      isPreviousDay: date.isBefore(today, "day"),
      isToday: date.isSame(today, "day"),
    });
  }

  return result;
});

/**
 * Generate schedule matrix based on schedules and columns
 */
const scheduleMatrix = computed(() => {
  // orders は後でFirestoreから取得することになる。
  // 現時点ではハードコードで対応。
  const orders = [
    { siteId: "59nZ6ilZy4WxKon5Yd0B", shiftType: "NIGHT" },
    { siteId: "59nZ6ilZy4WxKon5Yd0B", shiftType: "DAY" },
  ];

  const result = [];

  for (const order of orders) {
    const cells = [];

    for (const column of columns.value) {
      const matchingSchedules = props.schedules.filter(
        (s) =>
          s.siteId === order.siteId &&
          s.shiftType === order.shiftType &&
          s.date === column.date
      );

      cells.push({
        schedules: matchingSchedules,
        hasSchedules: matchingSchedules.length > 0,
        scheduleCount: matchingSchedules.length,
        column,
        key: `${order.siteId}-${order.shiftType}-${column.date}`,
      });
    }

    result.push({
      ...order,
      cells,
    });
  }

  return result;
});

/**
 * Get CSS classes for column header
 */
const getColumnHeaderClasses = (column) => ({
  "g-col": true,
  [`g-col-${column.dayOfWeek}`]: true,
  "g-col-previous": column.isPreviousDay,
  "g-col-today": column.isToday,
});

/**
 * Get CSS classes for table cell
 */
const getCellClasses = (column) => ({
  "g-col": true,
  [`g-col-${column.dayOfWeek}`]: true,
  "g-col-previous": column.isPreviousDay,
  "g-col-today": column.isToday,
});
</script>

<template>
  <v-table
    id="arrangement-table"
    class="d-flex flex-grow-1 overflow-hidden"
    fixed-header
  >
    <thead>
      <tr>
        <th
          v-for="column of columns"
          :key="column.date"
          :class="getColumnHeaderClasses(column)"
        >
          <v-icon v-if="column.isHoliday" color="red">mdi-flag-variant</v-icon>
          {{ column.col }}
        </th>
      </tr>
    </thead>
    <transition-group tag="tbody" name="fade">
      <template
        v-for="(orderData, rowIndex) of scheduleMatrix"
        :key="`site-row-${rowIndex}`"
      >
        <tr
          :ref="`${orderData.siteId}-${orderData.shiftType}`"
          class="g-row g-row-no-hover"
        >
          <td class="site-row" :colspan="columns.length + 1">
            <div>
              {{ orderData.siteId }}
            </div>
          </td>
        </tr>
        <tr class="g-row g-row-no-hover">
          <td
            v-for="cell of orderData.cells"
            :key="cell.key"
            :class="getCellClasses(cell.column)"
          >
            <div class="d-flex flex-column fill-height pa-2">
              <!-- スケジュールが存在する場合 -->
              <template v-if="cell.hasSchedules">
                <ArrangementsDraggableCell
                  v-for="(schedule, scheduleIndex) in cell.schedules"
                  :key="`${cell.key}-${scheduleIndex}`"
                  :schedule="schedule"
                  :cached-employees="cachedEmployees"
                  :cached-outsourcers="cachedOutsourcers"
                  class="mb-2"
                />
              </template>
              <!-- スケジュールが存在しない場合 -->
              <v-card v-else class="flex-grow-1 pa-2" variant="outlined">
                <!-- 空のカード -->
              </v-card>
            </div>
          </td>
        </tr>
      </template>
    </transition-group>
    <tfoot>
      <tr>
        <th
          v-for="column of columns"
          :key="column.date"
          :class="getColumnHeaderClasses(column)"
        >
          <v-icon v-if="column.isHoliday" color="red">mdi-flag-variant</v-icon>
          <span class="grey--text text--darken-2 text-subtitle-2">
            稼働数:
          </span>
        </th>
      </tr>
    </tfoot>
  </v-table>
</template>

<style scoped>
/* fixed テーブルに */
#arrangement-table > div > table {
  table-layout: fixed;
}

/* テーブルヘッダーのスタイル */
#arrangement-table > div > table > thead > tr > th {
  text-align: center;
  min-width: 280px;
}

/* 奇数行のサイト行の背景色 */
#arrangement-table > div > table > tbody > tr:nth-child(odd) .site-row {
  background-color: beige;
}

/* 奇数行のサイト行の左側を固定する */
#arrangement-table > div > table > tbody > tr:nth-child(odd) .site-row div {
  display: inline-block;
  position: sticky;
  left: 16px;
  z-index: 1 !important; /* 他の要素より前面に表示 */
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
.g-col.g-col-holi {
  background-color: #ffebee !important;
}

/* 日曜・祝日セルのホバー時背景色 */
.g-col.g-col-sun:hover,
.g-col.g-col-holi:hover {
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
</style>
