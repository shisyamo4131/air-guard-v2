<script setup>
/**
 * Bulk Schedule Manager Test Page
 * - 現場ごとの稼働予定のみを一括管理するためのテストページ
 */
import dayjs from "dayjs";
import { useDateUtil } from "@/composables/useDateUtil";
import { useSiteOrderManager } from "@/composables/useSiteOrderManager";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { SHIFT_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { mockSchedules } from "@/assets/schedules.test.js";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";

const { getDayInfo } = useDateUtil();
const { siteOrder } = useSiteOrderManager();

/** For site operation schedule management */
const siteOperationScheduleManager = useSiteOperationScheduleManager();

// テスト用フラグ
const USE_MOCK_DATA = true;

const { docs: realDocs } = useDocuments("SiteOperationSchedule", {
  fetchAllOnEmpty: true,
});

const docs = computed(() => (USE_MOCK_DATA ? mockSchedules : realDocs.value));

const propsFrom = "2025-12-20";
const dayCount = 30;

// ダイアログの状態管理
const isDialogOpen = ref(false);
const selectedCell = ref(null);

// 選択されたセルに該当するスケジュール一覧
const selectedSchedules = computed(() => {
  if (!selectedCell.value) return [];

  const { siteId, shiftType, date } = selectedCell.value;
  const orderKey = `${siteId}-${shiftType}`;

  return docs.value.filter((doc) => {
    return doc.orderKey === orderKey && doc.date === date;
  });
});

/**
 * Generate column data structure for table header
 * Creates column information for each date in the specified range
 */
const columns = computed(() => {
  let result = [];
  const from = dayjs(propsFrom);
  for (let i = 0; i < dayCount; i++) {
    const dateAt = from.add(i, "day");
    const date = dateAt.format("YYYY-MM-DD");
    result.push({
      date,
      ...getDayInfo({ date: dateAt }),
    });
  }
  return result;
});

/**
 * テーブル表示用のフラットなデータ構造
 */
const tableData = computed(() => {
  return siteOrder.value.map((order) => {
    // この行に関連するスケジュールを取得
    const filteredSchedules = docs.value.filter(
      (doc) => doc.orderKey === order.key
    );

    // 日付ごとにグループ化して合算（スケジュール数もカウント）
    const scheduleByDate = new Map();
    filteredSchedules.forEach((s) => {
      if (!scheduleByDate.has(s.date)) {
        scheduleByDate.set(s.date, {
          total: 0,
          count: 0,
        });
      }
      const data = scheduleByDate.get(s.date);
      data.total += s.requiredPersonnel || 0;
      data.count += 1;
      scheduleByDate.set(s.date, data);
    });

    // 列データを生成（全ての日付に対応）
    const cells = columns.value.map((col) => {
      const data = scheduleByDate.get(col.date);
      return {
        date: col.date,
        requiredPersonnel: data?.total || null,
        hasData: scheduleByDate.has(col.date),
        scheduleCount: data?.count || 0,
        hasMultiple: data?.count > 1,
      };
    });

    return {
      siteId: order.siteId,
      siteName: order.siteName,
      shiftType: order.shiftType,
      cells,
    };
  });
});

/**
 * セルクリック時の処理
 */
const handleCellClick = (row, cell) => {
  selectedCell.value = {
    siteId: row.siteId,
    siteName: row.siteName,
    shiftType: row.shiftType,
    date: cell.date,
    requiredPersonnel: cell.requiredPersonnel,
  };
  isDialogOpen.value = true;
};

/**
 * ダイアログを閉じる
 */
const closeDialog = () => {
  isDialogOpen.value = false;
  selectedCell.value = null;
};

/**
 * 日付フォーマット（表示用）
 */
const formatDate = (date) => {
  return dayjs(date).format("YYYY年M月D日(ddd)");
};

/**
 * 各日付の必要人数合計を計算
 */
const columnTotals = computed(() => {
  return columns.value.map((col) => {
    const total = tableData.value.reduce((sum, row) => {
      const cell = row.cells.find((c) => c.date === col.date);
      return sum + (cell?.requiredPersonnel || 0);
    }, 0);
    return {
      date: col.date,
      total,
    };
  });
});
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <v-table id="arrangement-table" fixed-header>
      <thead>
        <tr>
          <th>サイトID</th>
          <th v-for="col in columns" :key="col.date">
            {{ col.dateLabel }} ({{ col.dayOfWeekJp }})
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in tableData" :key="`${row.siteId}-${row.shiftType}`">
          <td>{{ row.siteName }}</td>
          <td
            v-for="cell in row.cells"
            :key="cell.date"
            class="cell-clickable"
            @click="handleCellClick(row, cell)"
          >
            <v-badge
              v-if="cell.hasData"
              :content="cell.scheduleCount"
              :model-value="cell.hasMultiple"
              color="error"
              location="top right"
            >
              <v-chip size="small" color="primary">
                {{ cell.requiredPersonnel }}
              </v-chip>
            </v-badge>
            <span v-else class="text-grey">-</span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="footer-row">
          <td class="font-weight-bold">合計</td>
          <td v-for="colTotal in columnTotals" :key="colTotal.date">
            <span class="font-weight-bold">{{ colTotal.total }}</span>
          </td>
        </tr>
      </tfoot>
    </v-table>

    <!-- スケジュール一覧表示ダイアログ -->
    <AtomsDialogsFullscreen v-model="isDialogOpen" max-width="600">
      <v-card>
        <template #title>
          <div v-if="selectedCell">
            {{ selectedCell.siteName }} -
            {{ SHIFT_TYPE_VALUES[selectedCell.shiftType].title }}
            <br />
            {{ formatDate(selectedCell.date) }}
          </div>
        </template>
        <v-card-text>
          <v-list v-if="selectedSchedules.length > 0">
            <v-list-item
              v-for="schedule in selectedSchedules"
              :key="schedule.docId"
            >
              <template #prepend>
                <v-icon icon="mdi-clipboard-text-outline" />
              </template>
              <v-list-item-title>
                {{ schedule.workDescription || "作業内容なし" }}
              </v-list-item-title>
              <v-list-item-subtitle>
                必要人数: {{ schedule.requiredPersonnel }}人
              </v-list-item-subtitle>
              <v-list-item-subtitle class="text-caption">
                ID: {{ schedule.docId }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="siteOperationScheduleManager.toUpdate(schedule)"
                />
              </template>
            </v-list-item>
          </v-list>
          <v-empty-state
            v-else
            action-text="登録する"
            title="スケジュールがありません"
            @click:action="
              siteOperationScheduleManager.toCreate({
                siteId: selectedCell.siteId,
                shiftType: selectedCell.shiftType,
                dateAt: dayjs(selectedCell.date).toDate(),
              })
            "
          ></v-empty-state>
        </v-card-text>
        <template #actions>
          <div class="d-flex flex-grow-1 justify-space-between">
            <v-btn
              v-if="selectedSchedules.length > 0"
              text="新規登録"
              prepend-icon="mdi-plus"
              color="primary"
              @click="
                siteOperationScheduleManager.toCreate({
                  siteId: selectedCell.siteId,
                  shiftType: selectedCell.shiftType,
                  dateAt: dayjs(selectedCell.date).toDate(),
                })
              "
            />
            <v-spacer />
            <v-btn
              text="閉じる"
              prepend-icon="mdi-close"
              @click="closeDialog"
            />
          </div>
        </template>
      </v-card>
    </AtomsDialogsFullscreen>

    <!-- スケジュール編集コンポーネント -->
    <OrganismsSiteOperationScheduleManager
      v-bind="siteOperationScheduleManager.attrs.value"
      :excludedKeys="['employees', 'outsourcers']"
    />
  </div>
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
  width: 104px;
  min-width: 104px;
  max-width: 104px;
  text-align: center;
}

/* 1列目のみ幅を変更してスクロールを固定 */
#arrangement-table th:nth-child(1),
#arrangement-table td:nth-child(1) {
  width: 240px !important;
  min-width: 240px !important;
  max-width: 240px !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: sticky;
  left: 0;
  z-index: 1 !important;
  text-align: left;
  background-color: white;
}

/* フッター行のスタイル */
.footer-row {
  background-color: #f5f5f5;
}

.footer-row td {
  border-top: 2px solid #e0e0e0;
}

/* セル全体をクリック可能に */
.cell-clickable {
  cursor: pointer;
}

.cell-clickable:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* チップのホバー効果 */
#arrangement-table .v-chip:hover {
  opacity: 0.8;
}
</style>
