<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Workers/Manager/index.vue
 * @description A component to manage `OperationResultDetail`.
 * @extends WorkersManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResult, OperationResultDetail } from "@/schemas";
// COMPOSABLES
import { useBaseManager } from "@/composables/useBaseManager";
// COMPONENTS
import CustomInput from "@/components/Operation/RowInput.vue";
import Toolbar from "./Toolbar.vue";
import { useOperationResultWriter } from "@/composables/application/operationResult/useOperationResultWriter";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "OperationResultWorkersManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  disabled: { type: Boolean, default: false },
  customInput: { type: Object, default: () => CustomInput },
  defaultDateAt: { type: Object, default: undefined },
  defaultSiteId: { type: String, default: undefined },
  defaultShiftType: { type: String, default: undefined },
  defaultStartTime: { type: String, default: undefined },
  defaultEndTime: { type: String, default: undefined },
  defaultIsStartNextDay: { type: Boolean, default: false },
  defaultRegulationWorkMinutes: { type: Number, default: undefined },
  defaultBreakMinutes: { type: Number, default: undefined },
  tableProps: { type: Object, default: () => ({}) },
  tableCard: { type: Boolean, default: false },
  result: {
    type: Object,
    default: () => new OperationResult(),
    validator: (value) => value instanceof OperationResult,
  },
});
const props = useDefaults(_props, "OperationResultWorkersManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationResultWorkersManager");
const result = computed(() => props.result);
const writer = useOperationResultWriter(result);
const manager = useTemplateRef("manager");
function reload(item) {
  const source = props.result?.workers?.find(
    (worker) => worker.workerId === (item?._beforeData?.workerId || item?.workerId),
  );
  if (source) item.initialize(source.toObject());
}
</script>

<template>
  <air-array-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :schema="OperationResultDetail"
    item-key="workerId"
    :before-edit="
      (editMode, item) => {
        if (editMode !== 'CREATE') return true;
        item.dateAt = props.defaultDateAt || item.dateAt;
        item.siteId = props.defaultSiteId || item.siteId;
        item.shiftType = props.defaultShiftType || item.shiftType;
        item.startTime = props.defaultStartTime || item.startTime;
        item.endTime = props.defaultEndTime || item.endTime;
        item.isStartNextDay = props.defaultIsStartNextDay;
        item.regulationWorkMinutes =
          props.defaultRegulationWorkMinutes ?? item.regulationWorkMinutes;
        item.breakMinutes = props.defaultBreakMinutes ?? item.breakMinutes;
        return true;
      }
    "
    :table-props="{ ...props.tableProps, hideSearch: true }"
    :custom-input="props.customInput"
    :disabled="props.disabled || !props.result?.docId || props.result.isLocked"
    :handle-create="writer.createWorker"
    :handle-update="writer.updateWorker"
    :handle-delete="writer.deleteWorker"
    :dialog-props="{ maxWidth: 760, persistent: true, scrollable: true }"
  >
    <template #table="tableProps">
      <component :is="props.tableCard ? 'v-card' : 'div'">
        <slot name="toolbar" v-bind="tableProps">
          <Toolbar v-bind="tableProps" />
        </slot>
        <WorkersDataTable v-bind="tableProps">
          <template v-for="(_, name) in $slots" #[name]="scope">
            <slot v-if="name !== 'toolbar'" :name="name" v-bind="{ ...tableProps, ...(scope || {}) }" />
          </template>
        </WorkersDataTable>
      </component>
    </template>
    <template #editor="editorProps">
      <OperationAirEditor
        :editor="editorProps"
        :errors="manager?.errors"
        title="作業員"
        :custom-input="props.customInput"
        :on-reload="editorProps.isDelete ? null : reload"
      />
    </template>
  </air-array-manager>
</template>
