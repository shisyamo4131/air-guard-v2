<script setup>
import CustomInput from "@/components/OperationBilling/CustomInput/index.vue";
import { OperationBilling } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

defineOptions({ inheritAttrs: false });
const props = defineProps({
  docs: { type: Array, default: null, validator: (value) => value === null || value.every((item) => item instanceof OperationBilling) },
  modelValue: { type: Array, default: () => [], validator: (value) => value.every((item) => item instanceof OperationBilling) },
  customInput: { type: [Object, Function], default: () => CustomInput },
});
const documents = computed(() => props.docs || props.modelValue);
const emit = defineEmits(["updated"]);
const { attrs } = useBaseManager("OperationBillingsManager");

function rejectUnsupportedOperation() { throw new Error("稼働請求の作成・削除はこの画面では実行できません。"); }
async function handleUpdate(draft) {
  return await OperationBilling.runTransaction(async (transaction) => {
    await draft.update({ transaction });
  });
}
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="documents"
    :schema="OperationBilling"
    :custom-input="props.customInput"
    item-key="docId"
    disable-create
    disable-delete
    hide-delete-btn
    :disable-update="(item) => !item?.docId"
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @update="emit('updated', $event)"
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope || {}" />
    </template>
  </air-array-manager>
</template>
