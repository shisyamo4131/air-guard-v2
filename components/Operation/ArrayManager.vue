<script setup>
import { useOperationEditor } from "@/composables/application/operation/useOperationEditor";
import { rawForClass } from "@/composables/domain/shared/valueContract";
import { SiteOperationSchedule, OperationResult, OperationBilling } from "@/schemas";
defineOptions({ inheritAttrs: false });
const props = defineProps({ kind: { type: String, required: true }, docs: { type: Array, default: () => [] }, customInput: { type: Object, default: null }, label: { type: String, default: undefined }, beforeEdit: { type: Function, default: null }, handleClickUpdate: { type: Function, default: null }, tableProps: { type: Object, default: () => ({}) } });
const resolvedLabel = computed(() => props.label ?? ({ schedule: SiteOperationSchedule, result: OperationResult, billing: OperationBilling }[props.kind]?.className || "稼働情報"));
const emit = defineEmits(["create", "update", "delete", "submit:complete"]);
let mode = null;
const editor = useOperationEditor({ kind: props.kind, onSaved: (item) => { emit(mode.toLowerCase(), item); emit("submit:complete", item); } });
async function open(nextMode, item) {
  if (props.kind === "billing" && nextMode !== "UPDATE") return false;
  if (nextMode !== "CREATE" && ((props.kind === "schedule" && item?.operationResultId) || (props.kind === "result" && item?.isLocked))) return false;
  if (nextMode === "CREATE") item = rawForClass(item?.toObject?.() || item || {});
  if (props.beforeEdit && await props.beforeEdit(nextMode, item) === false) return false;
  mode = nextMode; return editor.open(nextMode, item);
}
const toCreate = (item) => open("CREATE", item), toUpdate = (item) => open("UPDATE", item), toDelete = (item) => open("DELETE", item);
const table = computed(() => ({ ...props.tableProps, items: props.docs, label: resolvedLabel.value, itemKey: "docId", disabled: editor.busy.value, isLoading: editor.busy.value, loading: editor.busy.value, toCreate, toUpdate, toDelete, "onClick:create": toCreate, "onClick:update": props.handleClickUpdate || toUpdate, "onClick:delete": toDelete }));
defineExpose({ toCreate, toUpdate, toDelete });
</script>
<template>
  <div v-bind="$attrs" class="d-flex flex-column flex-grow-1 overflow-hidden">
    <slot name="table" v-bind="table"><air-data-table v-bind="table" /></slot>
    <OperationEditor :controller="editor" :title="resolvedLabel" :custom-input="customInput" />
  </div>
</template>
