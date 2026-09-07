import { computed } from "vue";
import { dateInput } from "@/functions/shared/employeeContract.js";
import { useOperationDuplicator } from "@/composables/application/operation/useOperationDuplicator";

export function useSiteOperationScheduleDuplicator() {
  const editor = useOperationDuplicator("schedule");
  const attrs = computed(() => ({
    modelValue: editor.opened.value, "onUpdate:modelValue": (value) => { if (!value) editor.close(); },
    selectedDates: editor.selectedDates.value, "onUpdate:selected-dates": (value) => { if (!editor.busy.value && !editor.uncertain.value) editor.selectedDates.value = value; },
    allowedDates: (value) => dateInput(value) !== editor.source.value?.date,
    disabled: editor.disabled.value, loading: editor.loading.value || editor.busy.value,
    blocked: editor.uncertain.value, error: editor.error.value,
    onSubmit: editor.save, onCancel: editor.close,
  }));
  return { attrs, set: editor.set };
}
