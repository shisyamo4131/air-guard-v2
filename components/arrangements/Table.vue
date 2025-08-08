<script setup>
/**
 * @file components/arrangements/Table.vue
 * @description 現場稼働予定のスケジュール管理テーブルコンポーネント。
 * vuedraggable を使用しており、以下の仕様になっています。
 * - 現場稼働予定自体を要素として、同じ現場・シフトの別の日に移動することができます。
 *   -> 別の日へ移すための更新処理には `reschedule` メソッドを使用します。
 */
import { inject } from "vue";
import { useLogger } from "@/composables/useLogger";
import DayCell from "@/components/Arrangements/DayCell";
import BodyCell from "@/components/Arrangements/BodyCell";
import FooterCell from "@/components/Arrangements/FooterCell";

/** define props */
const props = defineProps({
  showDebugInfo: { type: Boolean, default: false },
});

/** define emits */
const emit = defineEmits(["click:edit"]);

/** inject composable from parent */
const managerComposable = inject("scheduleManagerComposable");
const {
  cachedData,
  columns,
  localDocs,
  updateLocalDocs,
  keyMappedDocs,
  cellMatrix, // 現場、勤務区分、日付のマトリックス
} = managerComposable;

/** define composables */
const logger = useLogger();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * スケジュール日付変更処理（楽観的更新）
 */
async function handleChangeSchedule(event, dateAt) {
  logger.clearError();
  try {
    if (event.added) {
      const schedule = event.added.element;
      await schedule.reschedule(dateAt);
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
        <DayCell
          v-for="column of columns"
          :key="column.date"
          :isHoliday="column.isHoliday"
          :label="`${column.dateLabel}(${column.dayOfWeekJp})`"
          :cssClasses="column.cssClasses"
        />
      </tr>
    </thead>
    <tbody>
      <template
        v-for="(orderData, rowIndex) of cellMatrix"
        :key="`site-row-${rowIndex}`"
      >
        <ArrangementsSiteRow
          :colspan="columns.length"
          :shift-type="orderData.shiftType"
          :site="cachedData.sites[orderData.siteId]"
        />
        <tr class="g-row g-row-no-hover">
          <BodyCell
            v-for="cell of orderData.cells"
            :key="cell.key"
            :css-classes="cell.column.cssClasses"
            :model-value="keyMappedDocs[cell.key] || []"
            :site-id="orderData.siteId"
            :shift-type="orderData.shiftType"
            @update:model-value="
              updateLocalDocs(
                $event,
                orderData.siteId,
                orderData.shiftType,
                cell.column.date
              )
            "
            @change="handleChangeSchedule($event, cell.column.dateAt)"
            @click:edit="emit('click:edit', $event)"
          />
        </tr>
      </template>
    </tbody>
    <tfoot>
      <tr>
        <FooterCell
          v-for="column of columns"
          :key="column.date"
          :cssClasses="column.cssClasses"
          :required-personnel-total="column.requiredPersonnelTotal"
        />
      </tr>
    </tfoot>
  </v-table>

  <!-- デバッグ情報 -->
  <v-card v-if="props.showDebugInfo" class="ma-2" outlined>
    <v-card-title class="text-subtitle-2">
      スケジュール状態管理デバッグ（簡素化版）
    </v-card-title>
    <v-card-text class="py-2">
      <div class="text-caption">
        <div>総スケジュール数: {{ localDocs.length }}</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
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
