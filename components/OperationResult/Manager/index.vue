<script setup>
import CustomInput from "@/components/OperationResult/CustomInput/index.vue";
import { OperationResult } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useOperationResultWriter } from "@/composables/application/operationResult/useOperationResultWriter";
defineOptions({ inheritAttrs: false });
const props = defineProps({
  doc: {
    type: Object,
    default: () => new OperationResult(),
    validator: (value) => value instanceof OperationResult,
  },
  customInput: { type: [Object, Function], default: () => CustomInput },
});
const emit = defineEmits(["submit:complete"]);
const result = computed(() => props.doc);
const { attrs } = useBaseManager("OperationResultManager");
const { updateOverview } = useOperationResultWriter(result);
const manager = useTemplateRef("manager");
const toUpdate = (...args) => manager.value?.toUpdate(...args);
function reload(item) {
  item?.initialize?.(props.doc.toObject());
}
defineExpose({ toUpdate });
</script>
<template>
  <air-item-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.doc"
    :custom-input="props.customInput"
    :dialog-props="{ maxWidth: 760, persistent: true, scrollable: true }"
    :disable-update="!props.doc.docId || props.doc.isLocked"
    disable-delete
    hide-delete-btn
    :handle-update="updateOverview"
    @submit:complete="emit('submit:complete', $event.item)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="{ ...slotProps, disabled: slotProps.disableUpdate }" />
    </template>
    <template #editor="editorProps">
      <OperationAirEditor
        :editor="editorProps"
        :title="$attrs.label || '基本情報'"
        :custom-input="props.customInput"
        :on-reload="reload"
      />
    </template>
  </air-item-manager>
</template>
