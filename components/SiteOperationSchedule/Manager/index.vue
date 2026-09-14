<script setup>
import { useDefaults } from "vuetify";
import { useBaseManager } from "@/composables/useBaseManager";
import { SiteOperationSchedule } from "@/schemas";
import CustomInput from "@/components/SiteOperationSchedule/CustomInput";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/siteOperationScheduleHandlers";

defineOptions({ name: "SiteOperationScheduleManager", inheritAttrs: false });

const _props = defineProps({
  customInput: { type: [Object, Function], default: () => CustomInput },
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
const { attrs } = useBaseManager("SiteOperationScheduleManager");
const internalDoc = reactive(new SiteOperationSchedule());

watch(
  () => props.doc,
  (newDoc) => internalDoc.initialize(newDoc || null),
  { immediate: true, deep: true },
);

const manager = useTemplateRef("manager");
defineExpose({
  toCreate: (...args) => manager.value?.toCreate(...args),
  toUpdate: (...args) => manager.value?.toUpdate(...args),
  toDelete: (...args) => manager.value?.toDelete(...args),
});
</script>

<template>
  <air-item-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="internalDoc"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :custom-input="props.customInput"
    :disable-update="(item) => !!item?.operationResultId"
    :disable-delete="(item) => !!item?.operationResultId"
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope || {}" />
    </template>
  </air-item-manager>
</template>
