<script setup>
import CustomInput from "@/components/OperationResult/CustomInput/index.vue";
import { OperationResult } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
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
const { attrs } = useBaseManager("OperationResultManager");
const manager = useTemplateRef("manager");
const toUpdate = (...args) => manager.value?.toUpdate(...args);
const toDelete = (...args) => manager.value?.toDelete(...args);
const handleUpdate = (item) => item.update();
const handleDelete = (item) => item.delete();
defineExpose({ toDelete, toUpdate });
</script>
<template>
  <air-item-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.doc"
    :custom-input="props.customInput"
    :dialog-props="{ maxWidth: 760, persistent: true, scrollable: true }"
    :disable-update="!props.doc.docId || props.doc.isLocked"
    :disable-delete="!props.doc.docId || props.doc.isLocked"
    hide-delete-btn
    :handle-delete="handleDelete"
    :handle-update="handleUpdate"
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
      />
    </template>
  </air-item-manager>
</template>
