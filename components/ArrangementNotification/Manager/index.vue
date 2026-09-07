<script setup>
import CustomInput from "@/components/ArrangementNotification/CustomInput/index.vue";
import { useNotificationEditor } from "@/composables/application/operation/useNotificationEditor";
defineOptions({ inheritAttrs: false });
const props = defineProps({ doc: { type: Object, default: null }, customInput: { type: Object, default: () => CustomInput }, includesStatus: { type: Boolean, default: false }, beforeEdit: { type: Function, default: null } });
const emit = defineEmits(["submit:complete"]);
const editor = useNotificationEditor({ onSaved: (item) => emit("submit:complete", item) });
const toUpdate = async (item = props.doc) => { if (!item) return false; const opened = await editor.open(item); if (opened && props.beforeEdit) await props.beforeEdit("UPDATE", editor.draft.value); return opened; };
watch(() => props.doc?.docId, () => editor.reset());
defineExpose({ toUpdate });
</script>
<template>
  <slot name="activator" :item="doc" :to-update="toUpdate" :disabled="!editor.canWrite.value" :on-click:edit="() => toUpdate(doc)" />
  <OperationEditor :controller="editor" title="配置通知" :custom-input="props.customInput" :input-props="{ includesStatus }" />
</template>
