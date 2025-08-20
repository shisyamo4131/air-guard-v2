import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger";
import { ArrangementNotification } from "@/schemas";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

export function useArrangementNotificationManager({ dateRange } = {}) {
  const logger = useLogger("useArrangementNotificationManager");
  const loadingsStore = useLoadingsStore();

  if (!dateRange) {
    logger.error({ message: "Date range composable is required" });
  }

  const from = Vue.computed(() => dateRange.value.from);
  const to = Vue.computed(() => dateRange.value.to);

  const instance = Vue.reactive(new ArrangementNotification());

  const docs = Vue.ref([]);

  Vue.watchEffect(() => _initialize());

  function _initialize() {
    docs.value = instance.subscribeDocs({
      constraints: [
        ["where", "dateAt", ">", from.value],
        ["where", "dateAt", "<", to.value],
      ],
    });
  }

  const mappedDocs = Vue.computed(() => {
    return docs.value.reduce((acc, doc) => {
      acc[doc.docId] = doc;
      return acc;
    }, {});
  });

  const create = async (schedule) => {
    const key = loadingsStore.add(`Creating notifications`);
    try {
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadingsStore.remove(key);
    }
  };

  const hasNotification = (key) => {
    return !!mappedDocs.value[key];
  };

  return {
    docs,
    mappedDocs,

    create,
    hasNotification,
  };
}
