<script setup>
/*****************************************************************************
 * @file components/SiteOperationSchedule/Manager/index.vue
 * @description A component for managing single site operation schedule.
 * @extends AirItemManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useBaseManager } from "@/composables/useBaseManager";
import { SiteOperationSchedule } from "@/schemas";
import CustomInput from "@/components/SiteOperationSchedule/CustomInput";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/siteOperationScheduleHandlers";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteOperationScheduleManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  doc: {
    type: Object,
    default: null,
    validator: (value) =>
      value === null || value instanceof SiteOperationSchedule,
  },
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
});
const props = useDefaults(_props, "SiteOperationScheduleManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SiteOperationScheduleManager");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalDoc = reactive(new SiteOperationSchedule());
watch(
  () => props.doc,
  (newDoc) => internalDoc.initialize(newDoc || null),
  { immediate: true, deep: true },
);

/*****************************************************************************
 * TEMPLATE REF
 *****************************************************************************/
const component = useTemplateRef("component");

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
});
</script>

<template>
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    ref="component"
    :model-value="internalDoc"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :custom-input="props.customInput"
    :disable-update="(item) => !!item?.operationResultId"
    :disable-delete="(item) => !!item?.operationResultId"
  />
</template>
