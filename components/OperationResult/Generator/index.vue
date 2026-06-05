<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Generator/index.vue
 * @description A component to generate `OperationResult` document based on
 *              `SiteOperationSchedule` and `ArrangementNotification` documents.
 * @extends SiteOperationScheduleManager
 *
 * @note
 * 配置通知（ArrangementNotification）未作成状態の作業員を含む現場稼働予定（SiteOperationSchedule）が
 * 選択された場合、`ArrangementNotificationManager` の `doc` プロパティに null が渡されるのを避けるため
 * `selectedSchedule` を受け取るウォッチャー内で、選択された現場稼働予定に関連する配置通知を購読する前に、
 * 配置通知が存在しない作業員がいるかどうかを確認し、存在する場合は先に配置通知を作成します。
 *****************************************************************************/
import { useDefaults } from "vuetify";
/** SCHEMAS */
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
/** STORES */
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
/** COMPONENTS */
import List from "./List.vue";
import Detail from "./Detail.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  siteOperationSchedules: {
    type: Array,
    default: () => [],
    validator: (schedules) =>
      schedules.every((schedule) => schedule instanceof SiteOperationSchedule),
  },
});
const props = useDefaults(_props, "OperationResultGenerator");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
/** Messages store */
const messages = useMessagesStore();
/** Loadings store */
const loadings = useLoadingsStore();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
/** Selected `SiteOperationSchedule` document */
const selectedSchedule = ref(null);

/** For `ArrangementNotification` documents based on the selected `SiteOperationSchedule` */
const notificationInstance = reactive(new ArrangementNotification());
const notifications = ref([]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Returns a map of `ArrangementNotification` documents keyed by their `notificationKey`.
 * This allows for quick lookup of notifications based on worker and schedule information.
 */
const notificationsMap = computed(() => {
  return notifications.value.reduce((map, notification) => {
    map[`${notification.docId}`] = notification;
    return map;
  }, {});
});

/**
 * Returns the `siteOperationSchedules` prop sorted by date and shift type.
 * This can be used for displaying the schedules in a consistent order in the UI.
 */
const sortedSchedules = computed(() => {
  return [...props.siteOperationSchedules].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.shiftType < b.shiftType) return -1;
    if (a.shiftType > b.shiftType) return 1;
    return 0;
  });
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * Subscribe to `ArrangementNotification` documents when the selected schedule changes.
 * Unsubscribe from previous notifications if the selected schedule is cleared.
 */
watch(selectedSchedule, async (newSchedule) => {
  if (!newSchedule) {
    notificationInstance.unsubscribe();
    notifications.value = [];
  } else {
    /**
     * 配置通知（ArrangementNotification）未作成の状態の作業員がいる場合、
     * 作業員（Worker）のデータを編集することができないため、
     * 先に配置通知を作成する。
     */
    if (newSchedule.workers.some((worker) => !worker.hasNotification)) {
      const key = loadings.add(
        "未通知の作業員がいます。通知を作成しています...",
      );
      try {
        // 配置通知を作成（push 通知は送らない）
        await newSchedule.notify(false);
      } catch (error) {
        messages.add({ text: error.message, color: "error" });
      } finally {
        loadings.remove(key);
      }
    }
    notifications.value = notificationInstance.subscribeDocs({
      constraints: [
        ["where", "siteOperationScheduleId", "==", newSchedule.docId],
      ],
    });
  }
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handles the before edit action for a schedule item.
 * - Syncs the item (`SiteOperationSchedule`) to the corresponding `OperationResult`
 *   document using the related `ArrangementNotification` documents.
 * @param editMode The current edit mode.
 * @param item The schedule item to be edited.
 */
async function beforeEdit(editMode, item) {
  // Throw an error if the edit mode is not "UPDATE".
  if (editMode !== "UPDATE") {
    throw new Error("Unsupported edit mode: " + editMode);
  }

  // Sync the schedule item to the operation result using the notifications map.
  await item.syncToOperationResult(notificationsMap.value);

  // Show a success message and clear the selected schedules.
  messages.add("上下番を確定しました。");

  // Clear the selected schedule after syncing.
  selectedSchedule.value = null;

  // Return false to indicate that the edit action has been handled and no further processing is needed.
  return false;
}

/*****************************************************************************
 * PROVIDES
 *****************************************************************************/
provide("selectedSchedule", selectedSchedule); // For Detail.
provide("notifications", notifications); // For Detail.
provide("notificationsMap", notificationsMap); // For Detail.
</script>

<template>
  <SiteOperationSchedulesManager
    :docs="sortedSchedules"
    :before-edit="beforeEdit"
  >
    <template #table="{ items, toUpdate, isLoading }">
      <div class="d-flex fill-height ga-2">
        <!-- リスト表示部 -->
        <List class="fill-height" :items="items" />
        <!-- 詳細表示部 -->
        <Detail
          class="fill-height"
          :schedule="selectedSchedule"
          :notifications="notifications"
          :loading="isLoading"
          @click:submit="(schedule) => toUpdate(schedule)"
        />
      </div>
    </template>
  </SiteOperationSchedulesManager>
</template>
