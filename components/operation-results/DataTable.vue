<script setup>
/**
 * @file @/components/operation-results/DataTable.vue
 * @description 稼働実績明細用のデータテーブルコンポーネント
 * - `props.isEditing` が true を受け取ると編集用の表示に切り替わります。
 * - 氏名の表示には `props.employees` を与えられる必要があります。
 */
import dayjs from "dayjs";
import { OperationResultEmployee } from "@/schemas";

/** define props */
const props = defineProps({
  employees: { type: Object, default: () => ({}) },
  isEditing: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
});

/** define emits */
const emit = defineEmits(["update:items"]);

/** An array to manage internal items */
const internalItems = ref([]);
watch(
  () => props.items,
  (newVal) => {
    internalItems.value = newVal.map((item) => {
      return new OperationResultEmployee(item);
    });
  },
  { immediate: true, deep: true }
);

/** テーブルのカラム設定 */
const headers = [
  {
    title: "氏名",
    key: "employeeId",
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

/** props.isEditing を監視 -> false に更新された selectedEmployeeId を初期化 */
watch(
  () => props.isEditing,
  (newVal) => {
    if (!newVal) selectedEmployeeId.value = null;
  }
);

/** 従業員追加ボタンがクリックされた時の処理 */
function handleEmployeeIdAdded() {
  if (!selectedEmployeeId.value) return;
  const newEmployee = new OperationResultEmployee({
    employeeId: selectedEmployeeId.value,
    startAt: new Date(),
    endAt: new Date(),
  });
  internalItems.value.push(newEmployee);
  emit("update:items", internalItems.value);
  selectedEmployeeId.value = null;
}

/**
 * DateオブジェクトをHH:mm形式の文字列にフォーマットします
 * @param {Date | string} date
 * @returns {string}
 */
function formatTime(date) {
  return dayjs(date).format("YYYY-MM-DD HH:mm");
}
</script>

<template>
  <v-data-table
    :headers="headers"
    hide-default-footer
    :items="internalItems"
    items-per-page="-1"
  >
    <template #top>
      <!-- 従業員選択 Autocomplete コンポーネント -->
      <v-expand-transition>
        <div v-show="props.isEditing">
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

    <!-- 従業員ID -->
    <template #item.employeeId="{ item }">
      <div v-if="props.employees?.[item.employeeId]">
        {{ props.employees[item.employeeId]?.fullName || "ERROR" }}
      </div>
      <v-progress-circular v-else indeterminate size="small" />
    </template>

    <!-- 開始/終了時刻 -->
    <template
      v-for="key in ['startAt', 'endAt']"
      #[`item.${key}`]="{ item }"
      :key="key"
    >
      <div v-if="!props.isEditing">
        {{ formatTime(item[key]) }}
      </div>
      <air-date-time-picker-input
        v-else
        :model-value="item[key]"
        @update:modelValue="
          item[key] = $event;
          emit('update:items', internalItems);
        "
      >
        <template #activator="{ props: activatorProps }">
          <v-chip v-bind="activatorProps" density="compact">
            {{ activatorProps.text }}
          </v-chip>
        </template>
      </air-date-time-picker-input>
    </template>

    <!-- 資格者/OJT (boolean) -->
    <template
      v-for="key in ['isQualificated', 'isOjt']"
      #[`item.${key}`]="{ item }"
      :key="key"
    >
      <v-icon
        v-if="!props.isEditing"
        :icon="item[key] ? 'mdi-check' : ''"
        color="primary"
      />
      <v-icon
        v-else
        :icon="item[key] ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
        color="primary"
        @click="
          item[key] = !item[key];
          emit('update:items', internalItems);
        "
      />
    </template>
  </v-data-table>
</template>
