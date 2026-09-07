<script setup>
import { useOperationEditor } from "@/composables/application/operation/useOperationEditor";
import { SiteOperationSchedule, OperationResult, OperationBilling } from "@/schemas";
const props = defineProps({ kind: { type: String, required: true }, doc: { type: Object, default: null }, action: { type: String, default: "overview" }, label: { type: String, default: undefined }, customInput: { type: Object, default: null }, includedKeys: { type: Array, default: null }, beforeEdit: { type: Function, default: null }, disabled: { type: Boolean, default: false } });
const resolvedLabel = computed(() => props.label ?? ({ schedule: SiteOperationSchedule, result: OperationResult, billing: OperationBilling }[props.kind]?.className || "稼働情報"));
const emit = defineEmits(["submit:complete"]);
const editor = useOperationEditor({ kind: props.kind, defaultAction: props.action, fields: () => props.includedKeys, onSaved: (item) => emit("submit:complete", item) });
watch(() => props.doc?.docId, () => editor.reset());
async function open(mode, item) {
  if (props.disabled) return false;
  const target = item?.docId || mode === "CREATE" ? item : props.doc;
  if (props.beforeEdit && await props.beforeEdit(mode, target) === false) return false;
  return editor.open(mode, target);
}
const toCreate = (item = null) => open("CREATE", item), toUpdate = (item = props.doc) => open("UPDATE", item), toDelete = (item = props.doc) => open("DELETE", item);
const activator = computed(() => ({ item: props.doc, title: resolvedLabel.value, label: resolvedLabel.value, disabled: props.disabled || !editor.canWrite.value || editor.busy.value, toCreate, toUpdate, toDelete, "onClick:edit": () => toUpdate(props.doc) }));
defineExpose({ toCreate, toUpdate, toDelete });
</script>
<template>
  <slot v-if="$slots.activator" name="activator" v-bind="activator" />
  <v-btn v-else :disabled="activator.disabled" @click="doc ? toUpdate(doc) : toCreate()">{{ doc ? '編集' : '新規登録' }}</v-btn>
  <OperationEditor :controller="editor" :title="resolvedLabel" :custom-input="customInput" />
</template>
