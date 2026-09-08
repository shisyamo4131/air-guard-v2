<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
import { useOperationEditor } from "@/composables/application/operation/useOperationEditor";
import { operationRawFor, operationRowPosition } from "@/composables/domain/operation/operationRawContext";
import RowInput from "@/components/Operation/RowInput.vue";
defineOptions({ inheritAttrs: false });
const props = defineProps({ optimistic: { type: Object, default: null } });
const auth = useAuthStore();
const editor = useOperationEditor({ kind: "schedule", defaultAction: "workers", optimistic: props.optimistic });
async function open(rowAction, { schedule, worker }) {
  try {
    const raw = operationRawFor(schedule, `${auth.companyId}/${auth.uid}`);
    let array = worker.isEmployee ? "employees" : "outsourcers";
    let position = raw[array].length;
    if (rowAction !== "add") {
      const location = operationRowPosition(schedule, worker, `${auth.companyId}/${auth.uid}`);
      if (!location) throw new Error("行を選び直してください。");
      array = location.array; position = location.position;
    }
    await editor.open("UPDATE", schedule, { action: "workers", array, position, rowAction, raw });
    if (rowAction === "add") editor.update({ id: worker.id });
  } catch { editor.message.value = "最新の配置一覧から対象行を選び直してください。"; }
}
defineExpose({ toCreate: (args) => open("add", args), toUpdate: (args) => open("update", args), toDelete: (args) => open("remove", args) });
</script>
<template>
  <OperationEditor :controller="editor" title="作業員配置情報" :custom-input="RowInput" />
</template>
