<script setup>
/**
 * @file ./components/operation-results/EmployeesManager.vue
 * @description This component manages the operation results for employees.
 * Due to the specifications of the feature, the `ArrayManager` is not used to edit multiple elements.
 */
import dayjs from "dayjs";
import { OperationResultEmployee, Agreement } from "@/schemas";
import { useFetchEmployee } from "@/composables/useFetchEmployee";

/** define-props */
const props = defineProps({
  defaultAgreement: { type: Object, default: () => new Agreement() },
  isEditing: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] },
});

/** define-emits */
const emits = defineEmits(["update:isEditing", "update:modelValue"]);

/** define-composables */
const { fetchEmployee, cachedEmployees } = useFetchEmployee();

/** cloned modelValue */
const clonedModelValue = ref([]);

/** component's editing condition */
const isEditing = ref(false);

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
  if (isEditing.value) {
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
watch(() => props.modelValue, _initClonedModelValue, {
  immediate: true,
  deep: true,
});

watch(
  () => props.isEditing,
  (newVal) => {
    isEditing.value = newVal;
    emits("update:isEditing", newVal);
  },
  { immediate: true }
);

watch(isEditing, (newVal) => {
  if (!newVal) _initClonedModelValue();
});

watch(
  clonedModelValue,
  (newVal) => {
    fetchEmployee(newVal);
  },
  { immediate: true, deep: true }
);

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/

/**
 * Clone the modelValue to `clonedModelValue`.
 */
function _initClonedModelValue() {
  clonedModelValue.value = props.modelValue.map((item) => item.clone());
}

/**
 * Cancel the editing and reset the cloned model value.
 */
function cancel() {
  isEditing.value = false;
}

/**
 * Submit the changes and emit the updated model value.
 */
function submit() {
  emits("update:modelValue", clonedModelValue.value);
  isEditing.value = false;
}

/**
 * Processing when an employee ID is selected.
 * This function creates a new `OperationResultEmployee` instance
 * and adds it to the `clonedModelValue` array.
 * It also emits an update to the parent component
 * to reflect the changes in the items.
 */
function handleAddDetail() {
  if (!selectedEmployeeId.value) return;
  const newEmployee = new OperationResultEmployee({
    ...props.defaultAgreement,
    employeeId: selectedEmployeeId.value,
  });
  clonedModelValue.value.push(newEmployee);
  selectedEmployeeId.value = null;
}

/**
 * Remove a detail item from the internal items array.
 * This function finds the index of the item to be deleted,
 * removes it from the `clonedModelValue` array,
 * and emits an update to the parent component
 * to reflect the changes in the items.
 * @param item
 */
function handleRemoveDetail(item) {
  const index = clonedModelValue.value.indexOf(item);
  if (index !== -1) {
    clonedModelValue.value.splice(index, 1);
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
  <v-card>
    <v-toolbar density="comfortable">
      <v-toolbar-title>稼働実績明細（従業員）</v-toolbar-title>
      <v-spacer />
      <v-btn v-if="!isEditing" icon="mdi-pencil" @click="isEditing = true" />
      <div v-else>
        <v-btn icon="mdi-close" @click="cancel" />
        <v-btn icon="mdi-check" @click="submit" />
      </div>
    </v-toolbar>
    <v-data-table
      :headers="computedHeaders"
      hide-default-footer
      :items="clonedModelValue"
      items-per-page="-1"
    >
      <template #top>
        <!-- 従業員選択 Autocomplete コンポーネント -->
        <v-expand-transition>
          <div v-show="isEditing">
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
        <div v-if="cachedEmployees?.[item.employeeId]">
          {{ cachedEmployees[item.employeeId]?.fullName || "ERROR" }}
        </div>
        <v-progress-circular v-else indeterminate size="small" />
      </template>

      <!-- 開始/終了時刻 -->
      <template
        v-for="key in ['startAt', 'endAt']"
        #[`item.${key}`]="{ item }"
        :key="key"
      >
        <div v-if="!isEditing">
          {{ formatTime(item[key]) }}
        </div>
        <air-date-time-picker-input
          v-else
          :model-value="item[key]"
          @update:modelValue="item[key] = $event"
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
          v-if="!isEditing"
          :icon="item[key] ? 'mdi-check' : ''"
          color="primary"
        />
        <v-icon
          v-else
          :icon="
            item[key] ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'
          "
          color="primary"
          @click="item[key] = !item[key]"
        />
      </template>

      <!-- 削除ボタン -->
      <template #item.deletion="{ item }">
        <v-icon icon="mdi-trash-can" @click="handleRemoveDetail(item)" />
      </template>
    </v-data-table>
  </v-card>
</template>
