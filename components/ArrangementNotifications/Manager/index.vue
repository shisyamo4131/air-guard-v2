<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotifications/Manager/index.vue
 * @description A component for managing `ArrangementNotifications`.
 * @extends AirArrayManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { ArrangementNotification, SiteOperationSchedule } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  modelValue: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "ArrangementNotificationsManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs, isLoading, logger, isDev } = useBaseManager(
  "ArrangementNotificationsManager",
);
const loadings = useLoadingsStore();
const { ARRANGEMENT_NOTIFICATION_STATUS: DEFINITION } = useConstants();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const siteOperationSchedule = reactive(new SiteOperationSchedule());

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const internalDocs = computed(() => {
  return props.modelValue.toSorted((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    if (a.shiftType > b.shiftType) return 1;
    if (a.shiftType < b.shiftType) return -1;
    return 0;
  });
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function beforeEditHandler(editMode, notification) {
  const key = loadings.add("現場稼働予定を取得しています...");
  try {
    isLoading.value = true;
    await siteOperationSchedule.fetch({
      docId: notification.siteOperationScheduleId,
    });
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

async function onUpdateHandler(item) {
  const key = loadings.add("配置通知を更新しています...");
  try {
    isLoading.value = true;
    const nextDefinition = DEFINITION.value?.[item.status]?.next || null;
    if (!nextDefinition && isDev) {
      throw new Error(
        `No next status definition found for status: ${item.status}`,
      );
    }
    const transitionFn = item[nextDefinition?.transition] || null;
    if (typeof transitionFn !== "function" && isDev) {
      throw new Error(
        `Transition function ${nextDefinition?.transition} is not defined on the item.`,
      );
    }
    await transitionFn.call(item.clone());
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="internalDocs"
    :before-edit="beforeEditHandler"
    :schema="ArrangementNotification"
    :handle-update="onUpdateHandler"
    hide-delete-btn
  >
    <template #table="{ items, toUpdate }">
      <v-card>
        <v-toolbar color="secondary" density="compact" title="直近の配置情報" />
        <air-list v-if="items.length !== 0">
          <template v-for="(item, index) of items" :key="index">
            <ArrangementNotificationListItem
              v-bind="item"
              :notification="item"
              show-message
              show-status
              @click="() => toUpdate(item)"
            />
            <v-divider v-if="index < items.length - 1" />
          </template>
        </air-list>
      </v-card>
    </template>
    <template #input-default="{ item }">
      <!-- NOTIFICATION DETAIL -->
      <air-list fluid>
        <ArrangementNotificationListItem :notification="item" />
      </air-list>

      <!-- MEMBERS -->
      <v-card>
        <v-card-item>
          <v-card-title class="text-body-2">メンバー</v-card-title>
        </v-card-item>
        <v-card-text>
          <div class="d-flex flex-wrap ga-2">
            <WorkerChip
              v-for="(worker, index) of siteOperationSchedule.workers"
              :key="index"
              :worker="worker"
              density="compact"
            />
          </div>
        </v-card-text>
      </v-card>
    </template>
    <template #editor-actions="{ item, submit }">
      <ArrangementNotificationTransitionBtn
        :notification="item"
        type="next"
        block
        variant="elevated"
        @click="submit"
      />
    </template>
  </air-array-manager>
</template>
