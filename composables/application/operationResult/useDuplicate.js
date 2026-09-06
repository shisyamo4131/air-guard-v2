import { useOperationDuplicator } from "@/composables/application/operation/useOperationDuplicator";
export function useDuplicate() {
  let saved = null;
  const editor = useOperationDuplicator("result", (items) => { saved = items; });
  async function duplicate({ source, dates = [] } = {}) {
    if (editor.uncertain.value || !await editor.set(source)) return null;
    editor.selectedDates.value = dates; saved = null;
    return await editor.save() ? saved : null;
  }
  return { duplicate, loading: editor.busy };
}
