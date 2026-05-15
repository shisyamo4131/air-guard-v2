<script setup>
import { useUnconfirmedSiteOperationSchedules } from "@/composables/dataLayers/useUnconfirmedSiteOperationSchedules";
import { useFetch } from "@/composables/fetch/useFetch";
import { ArrangementNotification } from "@/schemas";
import { useMessagesStore } from "@/stores/useMessagesStore";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const selectedSchedules = ref([]);
const arrangementNotificationInstance = reactive(new ArrangementNotification());
const arrangementNotifications = ref([]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { docs } = useUnconfirmedSiteOperationSchedules();
useFetch("OperationResultRegister", true);
const messages = useMessagesStore();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const orderdDocs = computed(() => {
  return [...docs].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    if (a.shiftType < b.shiftType) return -1;
    if (a.shiftType > b.shiftType) return 1;
    return 0;
  });
});

const selectedSchedule = computed(() => {
  return selectedSchedules.value.length > 0 ? selectedSchedules.value[0] : null;
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(selectedSchedule, (newVal) => {
  if (!newVal) {
    arrangementNotificationInstance.unsubscribe();
  } else {
    arrangementNotifications.value =
      arrangementNotificationInstance.subscribeDocs({
        constraints: [["where", "siteOperationScheduleId", "==", newVal.docId]],
      });
  }
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function getArrangementNotification(worker) {
  return arrangementNotifications.value.find(
    (notification) =>
      notification.workerId === worker.workerId &&
      notification.siteOperationScheduleId === worker.siteOperationScheduleId,
  );
}

async function beforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return;
  const notificationsMap = arrangementNotifications.value.reduce(
    (map, notification) => {
      map[`${notification.notificationKey}`] = notification;
      return map;
    },
    {},
  );
  await item.syncToOperationResult(notificationsMap);
  messages.add("上下番を確定しました。");
  selectedSchedules.value = [];
  return false;
}
</script>

<template>
  <TemplatesFixedHeightContainer>
    <!-- <OrganismsOperationResultRegisterManager /> -->
    <SiteOperationSchedulesManager :docs="orderdDocs" :before-edit="beforeEdit">
      <template #table="{ items, toUpdate, isLoading }">
        <!-- リスト表示部 -->
        <div class="d-flex fill-height ga-2">
          <v-card class="fill-height d-flex flex-column w-20 flex-shrink-0">
            <div class="overflow-y-auto my-2">
              <SiteOperationSchedulesList
                v-model:selected="selectedSchedules"
                :schedules="items"
                selectable
              />
            </div>
          </v-card>

          <!-- 詳細表示部 -->
          <div class="fill-height flex-grow-1">
            <v-card class="fill-height d-flex flex-column">
              <v-card-text v-if="selectedSchedule" class="flex-grow-1">
                <SiteOperationScheduleTable
                  v-if="selectedSchedule"
                  :arrangement-notifications="arrangementNotifications"
                  :schedule="selectedSchedule"
                >
                  <template #append-header>
                    <th>ステータス</th>
                  </template>
                  <template #append="{ worker }">
                    <td>
                      <ArrangementNotificationManager
                        :doc="getArrangementNotification(worker)"
                      />
                    </td>
                  </template>
                </SiteOperationScheduleTable>
              </v-card-text>
              <v-empty-state
                v-else
                title="現場稼働予定を選択してください。"
                icon="mdi-alert-circle-outline"
              />
              <v-card-actions
                v-if="!!selectedSchedule"
                class="flex-grow-0 justify-end"
              >
                <v-btn
                  text="上下番を確定する"
                  :loading="isLoading"
                  :disabled="isLoading"
                  variant="flat"
                  block
                  color="primary"
                  @click="() => toUpdate(selectedSchedule)"
                />
              </v-card-actions>
            </v-card>
          </div>
        </div>
      </template>
    </SiteOperationSchedulesManager>
  </TemplatesFixedHeightContainer>
</template>
