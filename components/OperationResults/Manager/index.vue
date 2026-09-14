<script setup>
import { useDefaults } from "vuetify";
import CustomInput from "@/components/OperationResult/CustomInput/index.vue";
import { OperationResult } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/operationResultHandlers";

defineOptions({ name: "OperationResultsManager", inheritAttrs: false });

const _props = defineProps({
  docs: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every((item) => item instanceof OperationResult),
  },
  customInput: { type: [Object, Function], default: () => CustomInput },
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
});
const props = useDefaults(_props, "OperationResultsManager");
const { attrs } = useBaseManager("OperationResultsManager");
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.docs"
    :schema="OperationResult"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :custom-input="props.customInput"
    :disable-delete="(item) => item.isLocked"
    :disable-submit="(item) => item.isLocked"
    :dialog-props="{ maxWidth: 760, persistent: true, scrollable: true }"
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot v-if="name !== 'editor'" :name="name" v-bind="scope || {}" />
    </template>
    <template #editor="editorProps">
      <OperationAirEditor
        :editor="editorProps"
        :title="$attrs.label || '稼働実績'"
        :custom-input="props.customInput"
      />
    </template>
  </air-array-manager>
</template>
