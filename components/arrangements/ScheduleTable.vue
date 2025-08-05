<script setup>
/**
 * @file ScheduleTable.vue
 * @description 現場稼働予定のスケジュール管理テーブルコンポーネント。
 * vuedraggable を使用しており、以下の仕様になっています。
 * - 現場稼働予定自体を要素として、同じ現場・シフトの別の日に移動することができます。
 *   -> 別の日へ移すための更新処理には `reschedule` メソッドを使用します。
 */
import { inject, toRef, computed } from "vue";
import dayjs from "dayjs";
import { useLogger } from "@/composables/useLogger";
import { useSiteOrder } from "@/composables/useSiteOrder";
import { useScheduleTableColumns } from "@/composables/useScheduleTableColumns";
import { useSiteOperationScheduleState } from "@/composables/useSiteOperationScheduleState";
import DayCell from "@/components/Arrangements/DayCell";
import BodyCell from "@/components/Arrangements/BodyCell";
import FooterCell from "@/components/Arrangements/FooterCell";

/** define props */
const props = defineProps({
  schedules: { type: Array, required: true },
  dayCount: { type: Number, default: 7 },
  showDebugInfo: { type: Boolean, default: false },
});

/** define emits */
const emit = defineEmits(["click:edit"]);

/** inject from parent */
const managerComposable = inject("scheduleManagerComposable");
const { cachedData } = managerComposable;

/** define composables */
const logger = useLogger();
const siteOrder = useSiteOrder();
const { columns } = useScheduleTableColumns({
  dayCount: toRef(props, "dayCount"),
  startDate: computed(() => dayjs().subtract(1, "day").toDate()),
  schedules: toRef(props, "schedules"),
});
const scheduleState = useSiteOperationScheduleState({
  schedules: toRef(props, "schedules"),
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Generate schedule matrix based on schedules and columns
 */
const scheduleMatrix = computed(() => {
  return scheduleState.createScheduleMatrix.value(
    siteOrder.order.value,
    columns.value
  );
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * セルのスケジュール配列が更新された時の処理
 */
function updateSiteSchedules(newSchedules, siteId, shiftType, date) {
  scheduleState.updateCellSchedules(newSchedules, siteId, shiftType, date);
}

async function handleChangeSchedule(event, dateAt) {
  logger.clearError();
  try {
    if (event.added) {
      const schedule = event.added.element;
      // 楽観的更新で即座にローカル状態を更新済み
      // バックグラウンドでFirestoreを更新
      try {
        await schedule.reschedule(dateAt);
        scheduleState.markUpdateComplete(schedule.docId);
      } catch (error) {
        // 失敗時は楽観的更新をロールバック
        scheduleState.rollbackOptimisticUpdate(schedule.docId);
        throw error;
      }
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
        <DayCell
          v-for="column of columns"
          :key="column.date"
          :dateAt="column.dateAt"
        />
      </tr>
    </thead>
    <tbody>
      <template
        v-for="(orderData, rowIndex) of scheduleMatrix"
        :key="`site-row-${rowIndex}`"
      >
        <ArrangementsSiteRow
          :colspan="columns.length + 1"
          :shift-type="orderData.shiftType"
          :site="cachedData.sites[orderData.siteId]"
        />
        <tr class="g-row g-row-no-hover">
          <BodyCell
            v-for="cell of orderData.cells"
            :key="cell.key"
            :dateAt="cell.column.dateAt"
            :model-value="cell.schedules"
            :site-id="orderData.siteId"
            :shift-type="orderData.shiftType"
            @update:model-value="
              updateSiteSchedules(
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
          :date-at="column.dateAt"
          :required-personnel-total="column.requiredPersonnelTotal"
        />
      </tr>
    </tfoot>
  </v-table>

  <!-- デバッグ情報 -->
  <v-card v-if="props.showDebugInfo" class="ma-2" outlined>
    <v-card-title class="text-subtitle-2"
      >スケジュール状態管理デバッグ</v-card-title
    >
    <v-card-text class="py-2">
      <div class="text-caption">
        <div>
          総スケジュール数: {{ scheduleState.statistics.value.totalSchedules }}
        </div>
        <div>
          更新中: {{ scheduleState.statistics.value.pendingUpdatesCount }}
        </div>
        <div>
          楽観的更新:
          {{ scheduleState.statistics.value.optimisticUpdatesCount }}
        </div>
        <div>
          ステータス別:
          {{ JSON.stringify(scheduleState.statistics.value.schedulesByStatus) }}
        </div>
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
