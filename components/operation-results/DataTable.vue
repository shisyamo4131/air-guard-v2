<script setup>
/**
 * @file @/components/operation-results/DataTable.vue
 * @description 稼働実績明細用のデータテーブルコンポーネント
 * - `props.isEdit` が true を受け取ると編集用の表示に切り替わります。
 * - 氏名の表示には `props.employees` を与えられる必要があります。
 *
 * @events
 * - `add(employeeId: string)`: 従業員が追加されたときに発生します。
 * - `click:startAt(item: OperationResultEmployee)`: 開始時刻がクリックされたときに発生します。
 * - `click:endAt(item: OperationResultEmployee)`: 終了時刻がクリックされたときに発生します。
 */
import dayjs from "dayjs";

/** define props */
const props = defineProps({
  employees: { type: Object, default: () => ({}) },
  isEdit: { type: Boolean, default: false },
});

const emit = defineEmits([
  "add",
  "click:startAt",
  "click:endAt",
  "click:isQualificated",
  "click:isOjt",
]);

/** テーブルのカラム設定 */
const headers = [
  {
    title: "氏名",
    key: "employeeId",
    value: (item) => props.employees?.[item.employeeId]?.fullName || "N/A",
    sortable: false,
  },
  { title: "開始時刻", key: "startAt", align: "center", sortable: false },
  { title: "終了時刻", key: "endAt", align: "center", sortable: false },
  {
    title: "休憩時間",
    key: "breakTime",
    value: (item) => (item.breakMinutes / 60).toFixed(2),
    align: "center",
    sortable: false,
  },
  {
    title: "残業時間",
    key: "overTime",
    value: (item) => (item.overTimeMinutes / 60).toFixed(2),
    align: "center",
    sortable: false,
  },
  { title: "資格者", key: "isQualificated", align: "center", sortable: false },
  { title: "OJT", key: "isOjt", align: "center", sortable: false },
];

/** AirAutocompleteApi によって選択された従業員ID */
const selectedEmployeeId = ref(null);

/** props.isEdit を監視 -> false に更新された selectedEmployeeId を初期化 */
watch(
  () => props.isEdit,
  (isEditing) => {
    if (!isEditing) selectedEmployeeId.value = null;
  }
);

/** 従業員追加ボタンがクリックされた時の処理 */
function handleEmployeeIdAdded() {
  if (!selectedEmployeeId.value) return;
  emit("add", selectedEmployeeId.value);
  selectedEmployeeId.value = null;
}

/**
 * DateオブジェクトをHH:mm形式の文字列にフォーマットします
 * @param {Date | string} date
 * @returns {string}
 */
function formatTime(date) {
  return dayjs(date).format("HH:mm");
}
</script>

<template>
  <v-data-table :headers="headers" hide-default-footer items-per-page="-1">
    <template #top>
      <!-- 従業員選択 Autocomplete コンポーネント -->
      <v-expand-transition>
        <div v-show="props.isEdit">
          <v-container>
            <MoleculesAutocompleteEmployee
              v-model="selectedEmployeeId"
              append-icon="mdi-plus"
              icon-color="primary"
              @click:append="handleEmployeeIdAdded"
            />
          </v-container>
        </div>
      </v-expand-transition>
    </template>

    <!-- 開始/終了時刻 -->
    <template
      v-for="key in ['startAt', 'endAt']"
      #[`item.${key}`]="{ item }"
      :key="key"
    >
      <div v-if="!props.isEdit">
        {{ formatTime(item[key]) }}
      </div>
      <v-chip v-else density="compact" @click="emit(`click:${key}`, item)">
        {{ formatTime(item[key]) }}
      </v-chip>
    </template>

    <!-- 資格者/OJT (boolean) -->
    <template
      v-for="key in ['isQualificated', 'isOjt']"
      #[`item.${key}`]="{ item }"
      :key="key"
    >
      <v-icon
        v-if="!props.isEdit"
        :icon="item[key] ? 'mdi-check' : ''"
        color="primary"
      />
      <v-icon
        v-else
        :icon="item[key] ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
        color="primary"
        @click="emit('click:' + key, { item, value: !item[key] })"
      />
    </template>
  </v-data-table>
</template>
