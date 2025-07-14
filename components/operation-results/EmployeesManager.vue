<script setup>
/**
 * @file ./components/operation-results/EmployeesManager.vue
 * @description This component manages the operation results for employees.
 * Due to the specifications of the feature, the `ArrayManager` is not used to edit multiple elements.
 */
import dayjs from "dayjs";
import { useFetchEmployee } from "@/composables/useFetchEmployee";

/** define-props */
const props = defineProps({
  isEditing: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] },
});

/** define-emits */
const emit = defineEmits([
  "add",
  "click:cancel",
  "click:edit",
  "remove",
  "update:modelValue",
]);

/** define-composables */
const { fetchEmployee, cachedEmployees } = useFetchEmployee();

/** cloned modelValue */
const clonedModelValue = ref([]);

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
watch(() => props.modelValue, _initClonedModelValue, {
  immediate: true,
  deep: true,
});

watch(
  () => props.isEditing,
  (newVal) => newVal || _initClonedModelValue()
);

watch(clonedModelValue, (newVal) => fetchEmployee(newVal), {
  immediate: true,
  deep: true,
});

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/

/**
 * Clone the modelValue to `clonedModelValue`.
 */
function _initClonedModelValue() {
  clonedModelValue.value = props.modelValue.map((item) => item.clone());
}

function handleAddDetail() {
  if (!selectedEmployeeId.value) return;
  emit("add", selectedEmployeeId.value);
  selectedEmployeeId.value = null;
}
</script>

<template>
  <v-card>
    <v-toolbar density="comfortable">
      <v-toolbar-title>稼働実績明細（従業員）</v-toolbar-title>
      <v-spacer />
      <v-btn
        v-if="!props.isEditing"
        icon="mdi-pencil"
        @click="emit('click:edit')"
      />
      <div v-else>
        <v-btn icon="mdi-close" @click="emit('click:cancel')" />
        <v-btn icon="mdi-check" @click="emit('click:submit')" />
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
        <div v-if="!props.isEditing">
          {{ dayjs(item[key]).format("HH:mm") }}
        </div>
        <air-date-time-picker-input
          v-else
          :model-value="item[key]"
          @update:modelValue="
            item[key] = $event;
            emit('update:modelValue', clonedModelValue);
          "
        >
          <template #activator="{ props: activatorProps }">
            <v-chip v-bind="activatorProps" density="compact">
              {{ dayjs(activatorProps.text).format("HH:mm") }}
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
          :icon="
            item[key] ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'
          "
          color="primary"
          @click="
            item[key] = !item[key];
            emit('update:modelValue', clonedModelValue);
          "
        />
      </template>

      <!-- 削除ボタン -->
      <template #item.deletion="{ item }">
        <v-icon icon="mdi-trash-can" @click="emit('remove', item.employeeId)" />
      </template>
    </v-data-table>
  </v-card>
</template>
