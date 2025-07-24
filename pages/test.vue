<script setup>
import {
  Employee,
  OperationResultDetail,
  Outsourcer,
  SiteOperationSchedule,
} from "@/schemas";
import { useFetchEmployee } from "@/composables/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/useFetchOutsourcer";
import { useFloatingWindow } from "@/composables/useFloatingWindow";
import dayjs from "dayjs";
import { getDayType } from "air-guard-v2-schemas/constants";

/** define use composables */
const { fetchEmployee, cachedEmployees, pushEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers, pushOutsourcers } =
  useFetchOutsourcer();
const {
  isVisible: showEmployeeWindow,
  position: employeeWindowPosition,
  toggle: toggleEmployeeWindow,
  close: closeEmployeeWindow,
  updatePosition: onWindowMove,
} = useFloatingWindow();

/** define instances */
const employeeInstance = new Employee();
const scheduleInstance = reactive(new SiteOperationSchedule());
const outsourcerInstance = new Outsourcer();

/** define refs for vue-draggable */
const schedules = ref([]);
const employees = ref([]);
const outsourcers = ref([]);
const columns = ref([]);
const today = new Date();

/** define computed properties */
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
      const matchingSchedules = schedules.value.filter(
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

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(schedules, handleSchedulesChange, { deep: true });

/*****************************************************************************
 * LIFE CYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  await fetchEmployees();
  await fetchOutsourcers();
  schedules.value = scheduleInstance.subscribeDocs();

  // `columns` を初期化
  const startDate = dayjs().locale("en");
  const endDate = dayjs().locale("en").add(6, "day");
  const dayCount = endDate.diff(startDate, "day") + 1;

  columns.value = [];
  for (let i = 0; i < dayCount; i++) {
    const date = startDate.add(i, "day");
    columns.value.push({
      date: date.format("YYYY-MM-DD"),
      dateAt: date.toDate(),
      col: date.format("MM/DD"),
      dayOfWeek: date.format("ddd").toLowerCase(),
      isHoliday: getDayType(date.toDate()) === "holiday",
      isPreviousDay: date.isBefore(today, "day"),
      isToday: date.isSame(today, "day"),
    });
  }
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handle changes in schedules and fetch related employee and outsourcer data.
 * @param {Array} newSchedules - Updated schedules array
 */
function handleSchedulesChange(newSchedules) {
  if (!Array.isArray(newSchedules) || newSchedules.length === 0) {
    return;
  }

  const allEmployees = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.employees) ? schedule.employees : []
  );

  const allOutsourcers = newSchedules.flatMap((schedule) =>
    Array.isArray(schedule.outsourcers) ? schedule.outsourcers : []
  );

  if (allEmployees.length > 0) fetchEmployee(allEmployees);
  if (allOutsourcers.length > 0) fetchOutsourcer(allOutsourcers);
}

/**
 * Fetch employee documents and set them to the employees ref.
 * Employee documents are converted to OperationResultDetail instances.
 * @returns {Promise<void>}
 */
async function fetchEmployees() {
  let fetchResult = await employeeInstance.fetchDocs({
    constraints: [["where", "employmentStatus", "==", "ACTIVE"]],
  });
  pushEmployees(fetchResult); // コンポーザブルにキャッシュさせる
  employees.value = fetchResult.map(
    (doc) =>
      new OperationResultDetail({ workerId: doc.docId, isEmployee: true })
  );
}

/**
 * Fetch outsourcer documents and set them to the outsourcers ref.
 * Outsourcer documents are converted to OperationResultDetail instances.
 */
async function fetchOutsourcers() {
  const fetchResult = await outsourcerInstance.fetchDocs();
  pushOutsourcers(fetchResult); // コンポーザブルにキャッシュさせる
  outsourcers.value = fetchResult.map(
    (doc) =>
      new OperationResultDetail({ workerId: doc.docId, isEmployee: false })
  );
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <v-toolbar density="comfortable">
      <v-toolbar-title>配置管理</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="toggleEmployeeWindow($event)"
        :color="showEmployeeWindow ? 'primary' : 'default'"
      >
        <v-icon>mdi-account-group</v-icon>
      </v-btn>

      <!-- フローティング作業員選択ウィンドウ -->
      <ArrangementsWorkerSelector
        :is-visible="showEmployeeWindow"
        :initial-x="employeeWindowPosition.x"
        :initial-y="employeeWindowPosition.y"
        :employees="employees"
        :outsourcers="outsourcers"
        :cached-employees="cachedEmployees"
        :cached-outsourcers="cachedOutsourcers"
        @close="closeEmployeeWindow"
        @move="onWindowMove"
      />
    </v-toolbar>
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
            <v-icon v-if="column.isHoliday" color="red"
              >mdi-flag-variant</v-icon
            >
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
                  <!-- スケジュール数の表示（複数の場合） -->
                  <v-chip
                    v-if="cell.scheduleCount > 1"
                    size="x-small"
                    color="info"
                    class="mb-1 align-self-start"
                  >
                    {{ cell.scheduleCount }}件
                  </v-chip>
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
            <v-icon v-if="column.isHoliday" color="red"
              >mdi-flag-variant</v-icon
            >
            <span class="grey--text text--darken-2 text-subtitle-2">
              稼働数:
            </span>
          </th>
        </tr>
      </tfoot>
    </v-table>
  </div>
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
