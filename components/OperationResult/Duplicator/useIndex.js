import * as Vue from "vue";
import { useOperationDuplicator } from "@/composables/application/operation/useOperationDuplicator";
export function useIndex(emit) {
  const editor = useOperationDuplicator("result", (items) => { if (items[0]) emit("duplicated", items[0]); });
  return {
    set: editor.set,
    ui: Vue.computed(() => ({
      dialog: { modelValue: editor.opened.value, width: 328, persistent: true, "onUpdate:modelValue": (value) => { if (!value) editor.close(); } },
      picker: { modelValue: editor.selectedDates.value[0] || null, "onUpdate:modelValue": (value) => { if (!editor.busy.value && !editor.uncertain.value) editor.selectedDates.value = value ? [value] : []; }, hideHeader: true, multiple: false, disabled: editor.loading.value || editor.busy.value || editor.uncertain.value },
      actions: { disabled: editor.disabled.value, loading: editor.loading.value || editor.busy.value, "onClick:cancel": editor.close, "onClick:submit": editor.save },
      error: editor.error.value,
    })),
  };
}
