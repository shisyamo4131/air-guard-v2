<script setup>
import dayjs from "dayjs";
import { onMounted, onUnmounted } from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useArrangementNotificationManager } from "@/composables/useArrangementNotificationManager";
import { useDateRange } from "@/composables/useDateRange";

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new SiteOperationSchedule());
const selectedDoc = ref(null);
const loading = ref(false);

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const logger = useLogger("register", useErrorsStore());

// Date range for fetching arrangement notifications and site-operation-schedules.
// Defaults to the previous day's month.
const { dateRange } = useDateRange({
  baseDate: dayjs().subtract(1, "day").startOf("month"),
  dayCount: dayjs().subtract(1, "day").daysInMonth(),
});

const { fetchSite, cachedSites } = useFetchSite();
const { fetchEmployee, cachedEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers } = useFetchOutsourcer();
const {
  mappedDocs: notificationsMap,
  attrs: notificationAttrs,
  has: hasNotification,
  set: setNotification,
  isAllLeaved,
} = useArrangementNotificationManager({
  dateRange,
});

provide("cachedSites", cachedSites);
provide("cachedEmployees", cachedEmployees);
provide("cachedOutsourcers", cachedOutsourcers);
provide("notificationsMap", notificationsMap);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/** Returns the applicable agreement for the selected document */
const agreement = computed(() => {
  if (!selectedDoc?.value) return null;
  const site = cachedSites.value[selectedDoc?.value?.siteId];
  if (!site) return null;
  return site.getAgreement(selectedDoc.value);
});

const isImportable = computed(() => {
  if (!selectedDoc?.value) return false;
  return isAllLeaved(selectedDoc.value.docId);
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribe() {
  // Subscribe to operation results that are not yet linked to an operationResultId and are dated up to yesterday
  const constraints = [
    ["where", "operationResultId", "==", ""],
    // ["where", "date", "<=", dayjs().subtract(1, "day").format("YYYY-MM-DD")],
    ["where", "dateAt", ">=", dateRange.value.from],
    ["where", "dateAt", "<=", dateRange.value.to],
    ["orderBy", "dateAt"],
  ];

  // Define callback to fetch related data
  const callback = (item) => {
    fetchSite(item);
    fetchEmployee(item.employeeIds);
    fetchOutsourcer(item.outsourcerIds);
  };

  model.subscribeDocs({ constraints, callback });
}

async function submit() {
  try {
    loading.value = true;
    if (!agreement.value) throw new Error("取極めが未登録です。");
    await selectedDoc.value.syncToOperationResult(agreement.value);
    selectedDoc.value = null;
  } catch (error) {
    logger.error(error);
  } finally {
    loading.value = false;
  }
}

/**
 * Create `ArrangementNotification` documents for the selected schedule.
 * @returns {Promise<void>}
 */
async function notify() {
  try {
    loading.value = true;
    if (!selectedDoc.value) {
      throw new Error("現場稼働予定が選択されていません。");
    }
    await selectedDoc.value.notify();
  } catch (error) {
    logger.error(error);
  } finally {
    loading.value = false;
  }
}

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(dateRange, subscribe);

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(() => model.unsubscribe());
</script>

<template>
  <TemplatesFixedHeightContainer>
    <air-data-table
      :headers="[
        { title: '日付', key: 'date' },
        {
          title: '現場',
          key: 'siteId',
          value: (item) => cachedSites[item.siteId]?.name || 'loading...',
        },
      ]"
      :items="model.docs"
      @click:update="(item) => (selectedDoc = item)"
    >
    </air-data-table>
    <AtomsDialogsFullscreen
      :model-value="!!selectedDoc"
      max-width="800"
      scrollable
      persistent
      @update:model-value="() => (selectedDoc = null)"
    >
      <v-card>
        <v-toolbar flat density="compact">
          <v-toolbar-title>稼働実績確認</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="selectedDoc = null">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-table>
            <tbody>
              <OperationResultRegisterDateRow :date-at="selectedDoc?.dateAt" />
              <OperationResultRegisterSiteRow :site-id="selectedDoc?.siteId" />
              <OperationResultRegisterTimeRow :schedule="selectedDoc" />
              <OperationResultRegisterWorkersRow
                :workers="selectedDoc?.workers || []"
                @click:notification="setNotification"
              />
            </tbody>
          </v-table>

          <!-- Arrangement Notifications Status Updater -->
          <ArrangementNotificationsStatusUpdater v-bind="notificationAttrs" />
        </v-card-text>
        <v-container v-if="!agreement">
          <AtomsAlertsWarn>
            取極めが未登録です。先に取極めを登録する必要があります。
          </AtomsAlertsWarn>
        </v-container>
        <v-container
          v-if="
            selectedDoc && !hasNotification({ scheduleId: selectedDoc.docId })
          "
        >
          <v-banner color="error" icon="mdi-alert">
            <v-banner-text>
              配置通知が作成されていない作業員がいます。先に作成する必要があります。
            </v-banner-text>
            <template v-slot:actions>
              <v-btn :disabled="loading" :loading="loading" @click="notify"
                >作成</v-btn
              >
            </template>
          </v-banner>
        </v-container>
        <v-container v-else-if="!isImportable">
          <AtomsAlertsWarn> 下番実績のない作業員がいます。 </AtomsAlertsWarn>
        </v-container>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            :disabled="!agreement || !isImportable || loading"
            :loading="loading"
            @click="submit"
            >取込</v-btn
          >
        </v-card-actions>
      </v-card>
    </AtomsDialogsFullscreen>
  </TemplatesFixedHeightContainer>
</template>
