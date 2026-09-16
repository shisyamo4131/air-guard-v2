<script setup>
import { OperationBilling } from "@/schemas";
defineOptions({ name: "OperationBillingActivatorBaseBtnToggleLock", inheritAttrs: false });
const props = defineProps({ item: { type: Object, required: true, validator: (value) => value instanceof OperationBilling } });
const busy = ref(false), message = ref("");
async function toggleLock() {
  if (busy.value || !props.item.docId) return;
  busy.value = true; message.value = "";
  try {
    const draft = props.item.clone();
    await draft.toggleLock(!draft.isLocked);
  } catch { message.value = "ロック状態を保存できません。最新情報を確認してください。"; }
  finally { busy.value = false; }
}
</script>
<template>
  <v-alert v-if="message" type="warning">{{ message }}</v-alert>
  <v-btn v-bind="$attrs" class="mb-4" block :color="item.isLocked ? 'error' : 'primary'" :prepend-icon="item.isLocked ? 'mdi-lock-open' : 'mdi-lock'" :text="item.isLocked ? 'この稼働情報のロックを解除' : 'この稼働情報をロック'" :disabled="busy || !item.docId" :loading="busy" variant="flat" @click="toggleLock" />
</template>
