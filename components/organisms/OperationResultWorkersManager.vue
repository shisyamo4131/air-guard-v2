<script setup>
import { OperationResultDetail } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const logger = useLogger("OperationResultWorkersManager", useErrorsStore());

const { cachedEmployees, getEmployee, searchEmployees } = inject(
  "fetchEmployeeComposable"
);
const { cachedOutsourcers, getOutsourcer, searchOutsourcers } = inject(
  "fetchOutsourcerComposable"
);

/*****************************************************************************
 * PROPS
 *****************************************************************************/
const props = defineProps({
  hideCreateButton: { type: Boolean, default: false },
  hideAction: { type: Boolean, default: false },
});

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const isEmployee = ref(true);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function beforeEdit(editMode, item) {
  if (editMode === "CREATE") {
    item.isEmployee = isEmployee.value;
  } else {
    isEmployee.value = item.isEmployee;
  }
  return true;
}

/**
 * Get the display name of a worker from the cache.
 * @param {Object} worker - The worker object.
 * @return {string|undefined} The display name of the worker, or undefined if not found.
 */
function getDisplayName(worker) {
  if (worker.isEmployee) {
    return cachedEmployees.value?.[worker.employeeId]?.displayName || undefined;
  } else {
    return (
      cachedOutsourcers.value?.[worker.outsourcerId]?.displayName || undefined
    );
  }
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
    v-bind="$attrs"
    :schema="OperationResultDetail"
    :included-keys="[
      'id',
      'workerId',
      'startTime',
      'isStartNextDay',
      'endTime',
      'breakMinutes',
      'isQualified',
      'isOjt',
    ]"
    :table-props="{ hideSearch: true }"
    :before-edit="beforeEdit"
    item-key="workerId"
    @error="(error) => logger.error({ error })"
    @error:clear="() => logger.clearError()"
  >
    <template #table="tableProps">
      <v-card>
        <template #title>稼働実績明細</template>
        <template #append>
          <v-btn
            v-if="!hideCreateButton"
            text="従業員"
            prepend-icon="mdi-plus"
            @click="handleOnClickAddEmployee(tableProps.toCreate)"
          />
          <v-btn
            v-if="!hideCreateButton"
            text="外注先"
            prepend-icon="mdi-plus"
            @click="handleOnClickAddOutsourcer(tableProps.toCreate)"
          />
        </template>
        <air-data-table v-bind="tableProps" :hide-action="hideAction">
          <!-- DISPLAY NAME COLUMN -->
          <template #[`item.displayName`]="{ item }">
            <AtomsIconsHasLicense v-if="item?.isQualified" />
            <AtomsIconsIsOjt v-if="item?.isOjt" />
            <span v-if="getDisplayName(item)">
              {{ getDisplayName(item) }}
            </span>
            <v-progress-circular v-else indeterminate size="small" />
          </template>

          <!-- START TIME COLUMN -->
          <template #[`item.startTime`]="{ item }">
            <span style="position: relative">
              <AtomsChipsIsStartNextDay
                v-if="item.isStartNextDay"
                style="position: absolute; top: -8px"
              />
              {{ item.startTime }}</span
            >
          </template>
        </air-data-table>
      </v-card>
    </template>
    <template #[`input.id`]="{ attrs, editMode }">
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
    <template #[`input.isStartNextDay`]="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
  </air-array-manager>
</template>
