<script setup>
/**
 * @file ScheduleTable.vue
 * @description 現場稼働予定のスケジュール管理テーブルコンポーネント。
 * vuedraggable を使用しており、以下の仕様になっています。
 * - 現場稼働予定自体を要素として、同じ現場・シフトの別の日に移動することができます。
 *   -> 別の日へ移すための更新処理には `reschedule` メソッドを使用します。
 */
import draggable from "vuedraggable";
import dayjs from "dayjs";
import { getDayType, SHIFT_TYPE } from "air-guard-v2-schemas/constants";
import { useLogger } from "@/composables/useLogger";
import { useSiteOrder } from "@/composables/useSiteOrder";

/** define props */
const props = defineProps({
  schedules: { type: Array, required: true },
  cachedEmployees: { type: Object, default: () => ({}) },
  cachedOutsourcers: { type: Object, default: () => ({}) },
  cachedSites: { type: Object, default: () => ({}) },
  dayCount: { type: Number, default: 7 },
});

/** define emits */
const emit = defineEmits(["click:edit"]);

/** define composables */
const logger = useLogger();
const siteOrder = useSiteOrder();

/** define refs for optimistic updates */
const localSchedules = ref([]);

const today = new Date();

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
// props.schedulesの変更をlocalSchedulesに反映
watch(
  () => props.schedules,
  (newSchedules) => {
    localSchedules.value = [...newSchedules];
  },
  { immediate: true, deep: true }
);

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
  const result = [];

  for (const order of siteOrder.order.value) {
    const cells = [];

    for (const column of columns.value) {
      const matchingSchedules = localSchedules.value.filter(
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
        draggableName: `schedules-${order.siteId}-${order.shiftType}`,
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

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * セルのスケジュール配列が更新された時の処理
 */
function updateCellSchedules(newSchedules, siteId, shiftType, date) {
  // 現在のセルに該当しないスケジュールを保持
  const otherSchedules = localSchedules.value.filter(
    (s) =>
      !(s.siteId === siteId && s.shiftType === shiftType && s.date === date)
  );

  // 新しいスケジュールと結合
  localSchedules.value = [...otherSchedules, ...newSchedules];
}

async function handleChangeSchedule(event, dateAt) {
  logger.clearError();
  try {
    if (event.added) {
      const schedule = event.added.element;
      // バックグラウンドでFirestoreを更新（ローカルは既にdraggableで更新済み）
      await schedule.reschedule(dateAt);
    } else if (event.removed) {
      // 別の日に移動されたことによる削除イベントの場合
      // -> 別の日で added イベントが発生するため処理不要
      // その日のスケジュールとして削除された場合
      // -> 機能として未実装
    }
  } catch (error) {
    logger.error({
      sender: "handleChangeSchedule",
      message: error.message,
      error,
    });
  }
}
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
    <tbody>
      <template
        v-for="(orderData, rowIndex) of scheduleMatrix"
        :key="`site-row-${rowIndex}`"
      >
        <tr
          :ref="`${orderData.siteId}-${orderData.shiftType}`"
          class="g-row g-row-no-hover"
        >
          <td class="site-row" :colspan="columns.length + 1">
            <div
              v-if="props.cachedSites[orderData.siteId]"
              class="text-subtitle-1"
            >
              <div class="d-flex align-center">
                <v-chip class="mr-2" label size="small">
                  {{ SHIFT_TYPE[orderData.shiftType] }}
                </v-chip>
                <span>
                  {{ props.cachedSites[orderData.siteId].name }}
                </span>
              </div>
            </div>
            <!-- progress circular (shown if site is loading) -->
            <v-progress-circular v-else indeterminate size="small" />
          </td>
        </tr>
        <tr class="g-row g-row-no-hover">
          <td
            v-for="cell of orderData.cells"
            :key="cell.key"
            :class="getCellClasses(cell.column)"
          >
            <draggable
              :model-value="cell.schedules"
              item-key="docId"
              tag="div"
              class="d-flex flex-column fill-height pa-2"
              :group="{
                name: cell.draggableName,
                pull: (to, from, dragEl) => {
                  const element = dragEl.__draggable_context.element;
                  return element.isDraft;
                },
              }"
              @update:modelValue="
                updateCellSchedules(
                  $event,
                  orderData.siteId,
                  orderData.shiftType,
                  cell.column.date
                )
              "
              @change="handleChangeSchedule($event, cell.column.dateAt)"
            >
              <template #item="{ element }">
                <ArrangementsScheduleTag
                  :schedule="element"
                  :cached-employees="cachedEmployees"
                  :cached-outsourcers="cachedOutsourcers"
                  class="mb-2"
                  @click:edit="emit('click:edit', $event)"
                />
              </template>
            </draggable>
          </td>
        </tr>
      </template>
    </tbody>
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
  border: 1px solid grey;
}

/* テーブルヘッダーのスタイル */
#arrangement-table > div > table > tbody > tr > td {
  padding: 0px;
  border: 1px solid grey;
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
