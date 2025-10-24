<script setup>
/*****************************************************************************
 * OperationResultWorkersManager ver 1.0.0
 * @author shisyamo4131
 * @description A component for managing operation result workers.
 * - Displays a list of workers with their details.
 * - Allows adding, editing, and removing workers.
 * [NOTE]
 * Requires to using `addWorker` or `changeWorker` or `removeWorker` methods to modify workers.
 * So, this component does not handle create, update, and delete operations by itself.
 * Specify `handleCreate`, `handleUpdate`, and `handleDelete` props to handle these operations externally.
 * ---------------------------------------------------------------------------
 * @props {Function} handleCreate - Function to handle the creation of a worker.
 * @props {Function} handleUpdate - Function to handle the update of a worker.
 * @props {Function} handleDelete - Function to handle the deletion of a worker.
 * @props {Array} workers - The list of workers to manage.
 *****************************************************************************/
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { OperationResultDetail } from "@/schemas";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger(
  "OperationResultWorkersManager",
  useErrorsStore()
);
const { cachedEmployees, fetchEmployee, getEmployee, searchEmployees } =
  useFetchEmployee();
const { cachedOutsourcers, fetchOutsourcer, getOutsourcer, searchOutsourcers } =
  useFetchOutsourcer();

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  handleCreate: { type: Function, default: () => {} },
  handleUpdate: { type: Function, default: () => {} },
  handleDelete: { type: Function, default: () => {} },
  workers: { type: Array, default: () => [] },
});

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const isEmployee = ref(true);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/** Fetch employee and outsourcer data when workers change */
watch(
  () => props.workers,
  (newVal) => {
    newVal.forEach((worker) => {
      const fn = worker.isEmployee ? fetchEmployee : fetchOutsourcer;
      fn(worker.id);
    });
  },
  { immediate: true, deep: true }
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Get the display name of a worker from the cache.
 * @param {Object} worker - The worker object.
 * @return {string|undefined} The display name of the worker, or undefined if not found.
 */
function getDisplayName(worker) {
  if (worker.isEmployee) {
    return cachedEmployees.value[worker.employeeId]?.displayName || undefined;
  } else {
    return (
      cachedOutsourcers.value[worker.outsourcerId]?.displayName || undefined
    );
  }
}

/**
 * A handler executed before editing a worker.
 * - For "CREATE" mode, sets the isEmployee state based on the current isEmployee value.
 * - Sets the isEmployee state based on the item being edited when the edit mode is not "CREATE".
 * @param editMode
 * @param item
 */
function beforeEdit(editMode, item) {
  if (editMode === "CREATE") {
    item.isEmployee = isEmployee.value;
  } else {
    isEmployee.value = item.isEmployee;
  }
  return true;
}

function handleOnClickAddEmployee(handler) {
  isEmployee.value = true;
  handler();
}
function handleOnClickAddOutsourcer(handler) {
  isEmployee.value = false;
  handler();
}
</script>

<template>
  <air-array-manager
    :model-value="workers"
    :schema="OperationResultDetail"
    :input-props="{
      includedKeys: [
        'id',
        'startTime',
        'isStartNextDay',
        'endTime',
        'breakMinutes',
        'isQualificated',
        'isOjt',
      ],
    }"
    :table-props="{ hideSearch: true }"
    :before-edit="beforeEdit"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @error="error"
    @error:clear="clearError"
  >
    <template #table="tableProps">
      <air-data-table v-bind="tableProps">
        <template #toolbar-buttons>
          <v-btn
            text="従業員"
            prepend-icon="mdi-plus"
            @click="handleOnClickAddEmployee(tableProps.toCreate)"
          />
          <v-btn
            text="外注先"
            prepend-icon="mdi-plus"
            @click="handleOnClickAddOutsourcer(tableProps.toCreate)"
          />
        </template>
        <template #item.displayName="{ item }">
          <div v-if="getDisplayName(item)">
            {{ getDisplayName(item) }}
          </div>
          <v-progress-circular v-else indeterminate size="small" />
        </template>
      </air-data-table>
    </template>
    <template #id="{ attrs, editMode }">
      <air-autocomplete-api
        v-bind="attrs"
        :api="isEmployee ? searchEmployees : searchOutsourcers"
        clearable
        :disabled="editMode !== 'CREATE'"
        :fetchItemByKeyApi="isEmployee ? getEmployee : getOutsourcer"
        item-title="displayName"
        item-value="docId"
        :label="isEmployee ? '従業員' : '外注先'"
        required
      />
    </template>
    <template #isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
  </air-array-manager>
</template>
