import * as Vue from "vue";
import dayjs from "dayjs";
import { useDocManager } from "@/composables/useDocManager";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { SiteOperationSchedule } from "@/schemas";

export function useSiteOperationScheduleDuplicator({ redirectPath = null } = {}) {
  const instance = Vue.reactive(new SiteOperationSchedule());
  const selectedDates = Vue.ref([]);
  const docManager = useDocManager("useSiteOperationScheduleDuplicator", {
    doc: instance,
    redirectPath,
  });
  const loadingsStore = useLoadingsStore();

  function initialize() {
    instance.initialize();
    selectedDates.value = [];
  }

  async function duplicate() {
    docManager.logger.clearError();
    const loadingKey = loadingsStore.add({ text: "Duplicating schedule..." });
    docManager.isLoading.value = true;
    try {
      await instance.duplicate(selectedDates.value);
      initialize();
    } catch (error) {
      docManager.logger.error({ error });
    } finally {
      docManager.isLoading.value = false;
      loadingsStore.remove(loadingKey);
    }
  }

  function set(schedule) {
    if (!(schedule instanceof SiteOperationSchedule)) {
      throw new Error("Invalid schedule instance");
    }
    instance.initialize(schedule.toObject());
    docManager.toUpdate();
  }

  const attrs = Vue.computed(() => ({
    ...docManager.attrs.value,
    handleCreate: () => docManager.logger.error({ message: "作成処理はできません。" }),
    handleUpdate: duplicate,
    handleDelete: () => docManager.logger.error({ message: "削除処理はできません。" }),
    dialogProps: { width: 376 },
    disableCancel: docManager.isLoading.value,
    disableSubmit:
      selectedDates.value.length === 0 ||
      selectedDates.value.length > 20 ||
      docManager.isLoading.value,
    hideDeleteBtn: true,
    label: "予定複製",
    onInitialized: initialize,
    allowedDates: (date) =>
      dayjs(date).tz().format("YYYY-MM-DD") !== instance.date,
    selectedDates: selectedDates.value,
    "onUpdate:selected-dates": (value) => (selectedDates.value = value),
  }));

  return { attrs, set };
}
