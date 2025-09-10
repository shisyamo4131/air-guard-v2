<script setup>
/**
 * @file ./components/operation-results/EmployeesManager.vue
 * @description This component manages the operation results for employees.
 * Due to the specifications of the feature, the `ArrayManager` is not used to edit multiple elements.
 */
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("EmployeesManager", useErrorsStore());
const { fetchEmployee, cachedEmployees } = useFetchEmployee();

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  model: { type: Object, required: true },
});

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
/** define table's header */
const headers = ref([
  { title: "氏名", key: "employeeId", sortable: false },
  { title: "開始時刻", key: "startTime", align: "center", sortable: false },
  {
    title: "翌日開始",
    key: "isStartNextDay",
    align: "center",
    sortable: false,
  },
  { title: "終了時刻", key: "endTime", align: "center", sortable: false },
  {
    title: "休憩時間",
    key: "breakMinutes",
    align: "center",
    sortable: false,
  },
  {
    title: "残業時間",
    key: "overTimeWorkMinutes",
    align: "center",
    sortable: false,
  },
  { title: "資格者", key: "isQualificated", align: "center", sortable: false },
  { title: "OJT", key: "isOjt", align: "center", sortable: false },
]);

/** employee id selected at AutoCompleteApi */
const selectedEmployeeId = ref(null);

/** ItemManager reference */
const manager = useTemplateRef("manager");

const deletionColumn = {
  title: "削除",
  key: "deletion",
  align: "end",
  sortable: false,
};

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.model,
  (newVal) => fetchEmployee(newVal.employees),
  {
    immediate: true,
    deep: true,
  }
);

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
function addEmployee() {
  if (!selectedEmployeeId.value) return;
  manager.value?.item.addEmployee(selectedEmployeeId.value);
  fetchEmployee(selectedEmployeeId.value);
  selectedEmployeeId.value = null;
}

function quitEditing() {
  manager.value?.quitEditing();
  selectedEmployeeId.value = null;
}

function submit() {
  manager.value?.submit();
  selectedEmployeeId.value = null;
}
</script>

<template>
  <air-item-manager
    ref="manager"
    :model="model"
    v-slot="slotProps"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="error"
    @error:clear="clearError"
  >
    <v-card>
      <v-toolbar density="comfortable">
        <v-toolbar-title>稼働従業員</v-toolbar-title>
        <v-spacer />
        <v-btn
          v-if="!slotProps.isEditing"
          icon="mdi-pencil"
          @click="slotProps.toUpdate()"
        />
        <div v-else>
          <v-btn icon="mdi-close" @click="quitEditing" />
          <v-btn icon="mdi-check" @click="submit" />
        </div>
      </v-toolbar>
      <v-data-table
        :headers="slotProps.isEditing ? [...headers, deletionColumn] : headers"
        hide-default-footer
        :items="
          slotProps.isEditing ? slotProps.item.employees : model.employees
        "
        items-per-page="-1"
      >
        <template #top>
          <!-- 従業員選択 Autocomplete コンポーネント -->
          <v-expand-transition>
            <div v-show="slotProps.isEditing">
              <v-container>
                <MoleculesAutocompleteEmployee
                  v-model="selectedEmployeeId"
                  append-icon="mdi-plus"
                  icon-color="primary"
                  @click:append="addEmployee"
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
          v-for="key in ['startTime', 'endTime']"
          #[`item.${key}`]="{ item }"
          :key="key"
        >
          <div v-if="!slotProps.isEditing">
            {{ item[key] }}
          </div>
          <air-time-picker-input
            v-else
            :model-value="item[key]"
            :pickerProps="{
              format: '24hr',
            }"
            @update:modelValue="item[key] = $event"
          >
            <template #activator="{ props: activatorProps }">
              <v-chip v-bind="activatorProps">
                {{ item[key] }}
              </v-chip>
            </template>
          </air-time-picker-input>
        </template>

        <!-- 翌日開始フラグ (boolean) -->
        <template #item.isStartNextDay="{ item }">
          <v-icon
            v-if="!slotProps.isEditing"
            :icon="item.isStartNextDay ? 'mdi-check' : ''"
            color="primary"
          />
          <v-icon
            v-else
            :icon="
              item.isStartNextDay
                ? 'mdi-checkbox-marked'
                : 'mdi-checkbox-blank-outline'
            "
            color="primary"
            @click="item.isStartNextDay = !item.isStartNextDay"
          />
        </template>

        <!-- 休憩時間/残業時間 -->
        <template
          v-for="key in ['breakMinutes', 'overTimeWorkMinutes']"
          #[`item.${key}`]="{ item }"
          :key="key"
        >
          <div v-if="!slotProps.isEditing">
            {{ item[key] }}
          </div>
          <v-number-input
            v-else
            v-model="item[key]"
            :step="30"
            hide-details
            inset
            variant="solo-filled"
            flat
            single-line
            control-variant="split"
          >
            <template #decrement="{ props }">
              <v-btn v-bind="props" icon="mdi-minus" size="x-small" />
            </template>

            <template #increment="{ props }">
              <v-btn v-bind="props" icon="mdi-plus" size="x-small" />
            </template>
          </v-number-input>
        </template>

        <!-- 資格者/OJT (boolean) -->
        <template
          v-for="key in ['isQualificated', 'isOjt']"
          #[`item.${key}`]="{ item }"
          :key="key"
        >
          <v-icon
            v-if="!slotProps.isEditing"
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
          <v-icon
            icon="mdi-trash-can"
            @click="slotProps.item.removeEmployee(item.employeeId)"
          />
        </template>
      </v-data-table>
    </v-card>
  </air-item-manager>
</template>

<style scoped>
.v-number-input * {
  --v-input-control-height: 32px;
  --v-input-padding-top: 0px;
  --v-field-input-padding-bottom: 0px;
  --v-field-padding-bottom: 0px;
  font-size: 0.875rem; /* 14px */
}
</style>
