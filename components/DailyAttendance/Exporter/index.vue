<script setup>
/*****************************************************************************
 * @file components/DailyAttendance/Exporter/index.vue
 * @description 打刻データエクスポートコンポーネント
 *****************************************************************************/
import { useIndex } from "./useIndex";

defineOptions({
  name: "DailyAttendanceExporter",
  inheritAttrs: false,
});

const {
  ui,
  docs,
  previewItems,
  rejectedItems,
  exportableAttendanceCount,
} = useIndex();

const previewHeaders = [
  { title: "従業員コード", key: "employeeCode" },
  { title: "名前", key: "employeeName" },
  { title: "打刻種別", key: "punchType" },
  { title: "打刻日時", key: "punchDateTime" },
];

const rejectedHeaders = [
  { title: "勤務日", key: "date" },
  { title: "従業員コード", key: "employeeCode" },
  { title: "名前", key: "employeeName" },
  { title: "除外理由", key: "messages" },
];
</script>

<template>
  <v-card v-bind="$attrs" class="d-flex flex-column" variant="flat">
    <v-toolbar color="secondary" density="compact">
      <MoleculesMonthSelector v-bind="ui.monthSelector" />
      <v-spacer />
      <v-btn
        v-bind="ui.exportButton"
        prepend-icon="mdi-download"
        text="CSVエクスポート"
        variant="flat"
      />
    </v-toolbar>

    <v-card-text class="d-flex flex-wrap ga-2">
      <v-chip color="primary" variant="tonal">
        勤怠 {{ docs.length }}件
      </v-chip>
      <v-chip color="success" variant="tonal">
        出力可能 {{ exportableAttendanceCount }}件
      </v-chip>
      <v-chip
        :color="rejectedItems.length > 0 ? 'error' : undefined"
        variant="tonal"
      >
        除外 {{ rejectedItems.length }}件
      </v-chip>
      <v-chip variant="tonal">打刻 {{ previewItems.length }}件</v-chip>
    </v-card-text>

    <v-alert
      v-if="rejectedItems.length > 0"
      class="mx-4 mb-4"
      color="error"
      icon="mdi-alert"
      text="エクスポートできない勤怠データがあります。除外データを確認し、必要に応じて稼働実績を修正してください。"
      variant="tonal"
    />

    <div class="flex-grow-1">
      <v-card-title class="text-subtitle-1">出力プレビュー</v-card-title>
      <v-data-table
        :headers="previewHeaders"
        :items="previewItems"
        :items-per-page="20"
        item-value="id"
      />

      <template v-if="rejectedItems.length > 0">
        <v-divider />
        <v-card-title class="text-subtitle-1">除外データ</v-card-title>
        <v-data-table
          :headers="rejectedHeaders"
          :items="rejectedItems"
          :items-per-page="10"
          item-value="id"
        />
      </template>
    </div>
  </v-card>
</template>
