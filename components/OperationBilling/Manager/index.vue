<script setup>
import CustomInput from "@/components/OperationBilling/CustomInput/index.vue";
import { OperationBilling } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

defineOptions({ inheritAttrs: false });
const props = defineProps({
  doc: { type: Object, default: null, validator: (value) => value === null || value instanceof OperationBilling },
  modelValue: { type: Object, default: () => new OperationBilling(), validator: (value) => value instanceof OperationBilling },
  customInput: { type: [Object, Function], default: () => CustomInput },
});
const document = computed(() => props.doc || props.modelValue);
const emit = defineEmits(["updated"]);
const { attrs } = useBaseManager("OperationBillingManager");

function rejectUnsupportedOperation() { throw new Error("稼働請求の作成・削除はこの画面では実行できません。"); }
async function handleUpdate(draft) {
  return await OperationBilling.runTransaction(async (transaction) => {
    await draft.update({ transaction });
  });
}
</script>

<template>
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="document"
    :custom-input="props.customInput"
    :dialog-props="{ maxWidth: 760, persistent: true, scrollable: true }"
    :disable-update="!document?.docId"
    :before-edit="(mode) => mode === 'UPDATE' || rejectUnsupportedOperation()"
    disable-delete
    hide-delete-btn
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @update="emit('updated', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
