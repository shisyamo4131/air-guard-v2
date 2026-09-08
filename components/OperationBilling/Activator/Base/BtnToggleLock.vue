<script setup>
import { OperationBilling } from "@/schemas";
import { useOperationSubmission } from "@/composables/application/operation/useOperationSubmission";
import { expectedForOperation } from "@/composables/domain/operation/operationCommandContract";
defineOptions({ name: "OperationBillingActivatorBaseBtnToggleLock", inheritAttrs: false });
const props = defineProps({ item: { type: Object, required: true, validator: (value) => value instanceof OperationBilling } });
const submission = useOperationSubmission({ billing: true });
watch(() => props.item.docId, submission.reset);
async function toggleLock() {
  if (submission.busy.value || submission.uncertain.value || !submission.allowed.value) return;
  const id = props.item.docId, desiredLocked = !props.item.isLocked;
  try {
    const raw = await submission.read("OperationResults", id);
    if (!raw || props.item.docId !== id) return;
    const command = { kind: "billing", action: "lock", documentId: id, changes: { desiredLocked } };
    command.expected = expectedForOperation(raw, command);
    await submission.submit([command]);
  } catch { submission.message.value = "ロック状態を確認できません。最新情報を読み直してください。"; }
}
</script>
<template>
  <v-alert v-if="submission.message.value" type="warning">{{ submission.message.value }}</v-alert>
  <v-btn v-bind="$attrs" class="mb-4" block :color="item.isLocked ? 'error' : 'primary'" :prepend-icon="item.isLocked ? 'mdi-lock-open' : 'mdi-lock'" :text="item.isLocked ? 'この稼働情報のロックを解除' : 'この稼働情報をロック'" :disabled="submission.busy.value || submission.uncertain.value || !submission.allowed.value" :loading="submission.busy.value" variant="flat" @click="toggleLock" />
</template>
