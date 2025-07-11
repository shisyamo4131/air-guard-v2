<script setup>
/**
 * @file @/components/operation-results/DataTable.vue
 * @description Data table for operation result details(employees).
 * This component displays a table of employees with their operation results,
 * allowing for editing of start and end times, break times, overtime, and qualifications.
 */
import dayjs from "dayjs";
import { OperationResultEmployee } from "@/schemas";

/** define props */
const props = defineProps({
  defaultAttendance: {
    type: Object,
    default: () => ({
      startAt: new Date(),
      endAt: new Date(),
    }),
  },
  employees: { type: Object, default: () => ({}) },
  isEditing: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
});

/** define emits */
const emit = defineEmits(["update:items"]);

/**
 * An array to manage internal items
 * - Initialized with `props.items` mapped to `OperationResultEmployee` instances by watcher.
 */
const internalItems = ref([]);

/** define table's header */
const headers = ref([
  { title: "氏名", key: "employeeId", sortable: false },
  {
    title: "勤務日",
    key: "date",
    value: (item) => dayjs(item.startAt).format("YYYY-MM-DD"),
    align: "center",
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
]);

/** employee id selected at AutoCompleteApi */
const selectedEmployeeId = ref(null);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const computedHeaders = computed(() => {
  const defaultHeaders = headers.value.map((header) => header);
  if (props.isEditing) {
    defaultHeaders.push({
      title: "削除",
      key: "deletion",
      align: "end",
      sortable: false,
    });
  }
  return defaultHeaders;
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.items,
  (items) => {
    internalItems.value = items.map(
      (item) => new OperationResultEmployee(item)
    );
  },
  { immediate: true, deep: true }
);

/** props.isEditing を監視 -> false に更新された selectedEmployeeId を初期化 */
watch(
  () => props.isEditing,
  (newVal) => {
    if (!newVal) selectedEmployeeId.value = null;
  }
);

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
/**
 * Processing when an employee ID is selected.
 * This function creates a new `OperationResultEmployee` instance
 * and adds it to the `internalItems` array.
 * It also emits an update to the parent component
 * to reflect the changes in the items.
 */
function handleAddDetail() {
  if (!selectedEmployeeId.value) return;
  const newEmployee = new OperationResultEmployee({
    employeeId: selectedEmployeeId.value,
    startAt: props.defaultAttendance?.startAt || new Date(),
    endAt: props.defaultAttendance?.endAt || new Date(),
  });
  internalItems.value.push(newEmployee);
  emit("update:items", internalItems.value);
  selectedEmployeeId.value = null;
}

/**
 * Remove a detail item from the internal items array.
 * This function finds the index of the item to be deleted,
 * removes it from the `internalItems` array,
 * and emits an update to the parent component
 * to reflect the changes in the items.
 * @param item
 */
function handleRemoveDetail(item) {
  const index = internalItems.value.indexOf(item);
  if (index !== -1) {
    internalItems.value.splice(index, 1);
    emit("update:items", internalItems.value);
  }
}

/**
 * Format a date to a string in "HH:mm" format.
 * This function uses the `dayjs` library to format the date.
 * @param {Date | string} date
 * @returns {string}
 */
function formatTime(date) {
  return dayjs(date).format("HH:mm");
}
</script>

<template>
  <v-data-table
    :headers="computedHeaders"
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
              @click:append="handleAddDetail"
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
            {{ formatTime(activatorProps.text) }}
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

    <!-- 削除ボタン -->
    <template #item.deletion="{ item }">
      <v-icon icon="mdi-trash-can" @click="handleRemoveDetail(item)" />
    </template>
  </v-data-table>
</template>
