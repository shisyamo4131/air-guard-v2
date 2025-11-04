<script setup>
import dayjs from "dayjs";
import { onMounted, onUnmounted, reactive } from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useArrangementNotificationsForStatusUpdater } from "@/composables/useArrangementNotificationsForStatusUpdater";
import { useArrangementNotificationsManager } from "@/composables/useArrangementNotificationsManager";

/*****************************************************************************
 * DEFINE STORES
 *****************************************************************************/
const loadingsStore = useLoadingsStore();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive(new SiteOperationSchedule());
const selectedDoc = ref(null);
const loading = ref(false);
const dialog = ref(false);

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const logger = useLogger("register", useErrorsStore());
const { fetchSite, cachedSites } = useFetchSite();
const { fetchEmployee, cachedEmployees } = useFetchEmployee();
const { fetchOutsourcer, cachedOutsourcers } = useFetchOutsourcer();

provide("cachedSites", cachedSites);
provide("cachedEmployees", cachedEmployees);
provide("cachedOutsourcers", cachedOutsourcers);

const arrangementNotifications = useArrangementNotificationsForStatusUpdater();
const arrangementNotificationsManager = useArrangementNotificationsManager(
  arrangementNotifications.docs
);
const {
  keyMappedDocs: notificationsMap,
  has: hasNotification,
  set: setNotification,
  isAllLeaved,
} = arrangementNotificationsManager;
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
 * WATCHERS
 *****************************************************************************/
watch(selectedDoc, (newVal) => {
  if (!newVal) {
    arrangementNotifications.unsubscribe();
    return;
  }

  // 配置通知のリアルタイムリスナーを設定
  // 取得に若干の時間がかかるため、ダイアログ表示を遅延させる
  // 少しトリッキーな処理だが、将来的に警備日報の写真をロードして表示するなど
  // 時間のかかる処理を追加することになるため、一旦このままにしておく。
  arrangementNotifications.subscribe(newVal.docId);
  const loadingsKey = loadingsStore.add("配置通知を取得中...");
  setTimeout(() => {
    loadingsStore.remove(loadingsKey);
    dialog.value = true;
  }, 500);
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function subscribe() {
  // Subscribe to SiteOperationSchedule that are not yet linked to an operationResultId and are dated up to yesterday
  const constraints = [
    ["where", "operationResultId", "==", null],
    ["where", "date", "<=", dayjs().format("YYYY-MM-DD")],
    ["orderBy", "date"],
  ];

  // Define callback to fetch related data
  const callback = (item) => {
    fetchSite(item);
    fetchEmployee(item.employeeIds);
    fetchOutsourcer(item.outsourcerIds);
  };

  model.subscribeDocs({ constraints }, callback);
}

/**
 * Submit the operation result with the selected agreement.
 * @returns {Promise<void>}
 */
async function submit() {
  try {
    loading.value = true;
    if (!agreement.value) throw new Error("取極めが未登録です。");
    await selectedDoc.value.syncToOperationResult(
      agreement.value,
      notificationsMap.value
    );
    dialog.value = false;
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
  const loadingsKey = loadingsStore.add("配置通知を作成中...");
  loading.value = true;
  try {
    if (!selectedDoc.value) {
      throw new Error("現場稼働予定が選択されていません。");
    }
    await selectedDoc.value.notify();
  } catch (error) {
    logger.error(error);
  } finally {
    loading.value = false;
    loadingsStore.remove(loadingsKey);
  }
}

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(subscribe);
onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <div>
    <air-data-table
      :headers="[
        { title: '日付', key: 'date' },
        {
          title: '現場',
          key: 'siteId',
          value: (item) => cachedSites[item.siteId]?.name || 'loading...',
        },
      ]"
      hide-search
      :items="model.docs"
      label="上下番確定処理"
      :sortBy="[{ key: 'date' }]"
      @click:update="(item) => (selectedDoc = item)"
    >
    </air-data-table>
    <AtomsDialogsFullscreen
      v-model="dialog"
      max-width="800"
      scrollable
      persistent
      @after-leave="selectedDoc = null"
    >
      <v-card>
        <v-toolbar flat density="compact">
          <v-toolbar-title>上下番確定処理</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn :disabled="loading" icon @click="dialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-table>
            <tbody>
              <OperationResultRegisterDateRow :date-at="selectedDoc?.dateAt" />
              <OperationResultRegisterSiteRow :site-id="selectedDoc?.siteId" />
              <OperationResultRegisterAgreementRow :agreement="agreement" />
              <OperationResultRegisterTimeRow :schedule="selectedDoc" />
              <OperationResultRegisterWorkersRow
                :agreement="agreement"
                :workers="selectedDoc?.workers || []"
                @click:notification="setNotification"
                @click:notify="notify"
              />
            </tbody>
          </v-table>

          <OrganismsArrangementNotificationsStatusUpdater
            v-bind="arrangementNotificationsManager.attrs.value"
            hide-table
          />
        </v-card-text>
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
            color="primary"
            :disabled="!agreement || !isImportable || loading"
            :loading="loading"
            prepend-icon="mdi-check"
            @click="submit"
            >上下番を確定する</v-btn
          >
        </v-card-actions>
      </v-card>
    </AtomsDialogsFullscreen>
  </div>
</template>
