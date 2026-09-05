<script setup>
/*****************************************************************************
 * @file ./pages/sites/[id].vue
 * @description 現場詳細ページ
 * @use useFetch (origin)
 *****************************************************************************/
import dayjs from "dayjs";
import { useRoute } from "vue-router";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useDateRange } from "@/composables/useDateRange";
import { useFetch } from "@/composables/fetch/useFetch";
import { getSiteLifecyclePresentation } from "@/composables/domain/site/siteLifecyclePresentation";
import { useSiteActions } from "@/composables/application/site/useSiteActions";
import { Site, SiteEmployeeHistory } from "@/schemas";
import { getSitePresentationBadges } from "@/composables/domain/site/siteUiPresentation";
import { useSiteUiReads } from "@/composables/dataLayers/site/useSiteUiReads";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "site-detail" });

/*****************************************************************************
 * ROUTER
 *****************************************************************************/
const route = useRoute();
const docId = computed(() => String(route.params.id || ""));

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const doc = reactive(new Site());
const detailResolved = ref(false);
const detailError = ref("");
const { lookupSite } = useSiteUiReads();
const { canWrite } = useSiteActions();
const hasSite = computed(() => !!docId.value && doc.docId === docId.value);
const isMissing = computed(() => detailResolved.value && !hasSite.value && !detailError.value);
const isActive = computed(() => hasSite.value && doc.status === "ACTIVE");

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().tz().startOf("month").toDate();
const endDate = dayjs().tz().endOf("month").toDate();
const dateRangeComposable = useDateRange({ baseDate, endDate });
const { dateRange, debouncedDateRange } = dateRangeComposable;

/*****************************************************************************
 * SETUP FETCH COMPOSABLE (ROOT)
 *****************************************************************************/
const { fetchEmployeeComposable } = useFetch("site-detail", true);
const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;

/*****************************************************************************
 * SETUP SITE EMPLOYEE HISTORIES DATA LAYER COMPOSABLE
 *****************************************************************************/
const historyInstance = reactive(new SiteEmployeeHistory());
const siteEmployeeHistories = historyInstance.docs;
const sortedHistories = computed(() => {
  return [...siteEmployeeHistories].sort((a, b) => {
    const kanaA = cachedEmployees.value[a.employeeId]?.displayNameKana ?? "";
    const kanaB = cachedEmployees.value[b.employeeId]?.displayNameKana ?? "";
    return kanaA.localeCompare(kanaB, "ja");
  });
});
/**
 * Subscribe to `SiteOperationSchedule` documents that match the following conditions:
 * - `siteId` equals the current `docId`
 * - `dateAt` is between the `from` and `to` values of the debounced date range
 * The resulting documents are stored in the `schedules` variable for use in the component.
 */
const options = computed(() => {
  return [
    ["where", "siteId", "==", docId.value],
    ["where", "dateAt", ">=", debouncedDateRange.value.from],
    ["where", "dateAt", "<=", debouncedDateRange.value.to],
  ];
});
const { docs: displayedSchedules } = useDocuments("SiteOperationSchedule", {
  options,
  fetchAllOnEmpty: true,
});
const allScheduleOptions = computed(() => [
  ["where", "siteId", "==", docId.value],
]);
const { docs: schedules } = useDocuments("SiteOperationSchedule", {
  options: allScheduleOptions,
  fetchAllOnEmpty: true,
});
const lifecycle = computed(() => getSiteLifecyclePresentation(doc, { schedules }));
const badges = computed(() => getSitePresentationBadges(doc));

let detailSequence = 0;
async function subscribeDetail(id) {
  const sequence = ++detailSequence;
  doc.unsubscribe();
  historyInstance.unsubscribe();
  doc.initialize();
  detailResolved.value = false;
  detailError.value = "";
  if (!id) {
    detailResolved.value = true;
    return;
  }
  try {
    const initial = await lookupSite(id);
    if (sequence !== detailSequence || id !== docId.value) return;
    if (!initial) {
      detailResolved.value = true;
      return;
    }
    doc.initialize(initial.toObject?.() ?? initial);
    detailResolved.value = true;
    doc.subscribe({ docId: id }, (value) => {
      if (sequence !== detailSequence || id !== docId.value) return;
      detailResolved.value = true;
      if (!value) doc.initialize();
    });
    historyInstance.subscribeDocs({
      constraints: [["where", "siteId", "==", id]],
    }, (history) => {
      if (history?.employeeId) fetchEmployee(history.employeeId);
    });
  } catch {
    if (sequence !== detailSequence || id !== docId.value) return;
    detailError.value = "現場情報を読み込めませんでした。";
    detailResolved.value = true;
  }
}

watch(docId, subscribeDetail, { immediate: true });
onUnmounted(() => {
  detailSequence += 1;
  doc.unsubscribe();
  historyInstance.unsubscribe();
});

function handleArchived() {
  navigateTo("/sites");
}
</script>

<template>
  <v-container>
    <v-progress-linear v-if="!detailResolved" indeterminate class="mb-4" />
    <v-alert v-else-if="detailError" type="error" variant="tonal" class="mb-4">
      {{ detailError }}
    </v-alert>
    <v-alert v-else-if="isMissing" type="warning" variant="tonal" class="mb-4">
      指定された現場は見つかりません。
    </v-alert>
    <template v-if="hasSite">
    <v-card class="mb-4" variant="tonal">
      <v-card-text class="d-flex align-center flex-wrap ga-3">
        <v-chip
          v-for="badge in badges"
          :key="badge.key"
          :color="badge.color"
          variant="flat"
        >
          {{ badge.label }}
        </v-chip>
        <v-chip
          v-if="!badges.some((badge) => badge.label === lifecycle.label)"
          :color="lifecycle.color"
          variant="outlined"
        >
          {{ lifecycle.label }}
        </v-chip>
        <v-chip v-if="lifecycle.automaticTerminationDate" variant="outlined">
          自動終了予定 {{ lifecycle.automaticTerminationDate }}
        </v-chip>
        <strong>{{ doc.displayName || doc.name || doc.docId }}</strong>
        <span v-if="doc.code">コード: {{ doc.code }}</span>
        <span>{{ doc.fullAddress || "住所未設定" }}</span>
        <v-spacer />
        <SiteArchiveDialog v-if="canWrite" :site="doc" @archived="handleArchived" />
        <SiteEditorTerminate v-if="isActive" :site="doc">
          <template #activator="{ open, disabled }">
            <v-btn color="warning" variant="outlined" :disabled="disabled" @click="open">現場を終了</v-btn>
          </template>
        </SiteEditorTerminate>
        <SiteEditorReactivate v-else :site="doc">
          <template #activator="{ open, disabled }">
            <v-btn color="primary" variant="flat" :disabled="disabled" @click="open">再有効化</v-btn>
          </template>
        </SiteEditorReactivate>
      </v-card-text>
    </v-card>
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <SiteEditorBase :site="doc">
              <template #activator="{ open }">
                <SiteActivatorBase
                  :item="doc"
                  title="基本情報"
                  :editable="canWrite && isActive"
                  @click:edit="open"
                />
              </template>
            </SiteEditorBase>
          </v-col>

          <!-- 取引先情報 -->
          <v-col cols="12">
            <SiteEditorCustomer :site="doc">
              <template #activator="{ open }">
                <SiteActivatorCustomer
                  :item="doc"
                  title="取引先情報"
                  :editable="canWrite && isActive"
                  @click:edit="open"
                />
              </template>
            </SiteEditorCustomer>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" md="8">
        <v-row>
          <!-- 稼働予定 -->
          <v-col cols="12">
            <SiteOperationSchedulesManager
              :before-edit="(editMode, item) => (item.siteId = docId)"
              :date-at="dateRange.from"
              :docs="displayedSchedules"
              :site-id="docId"
              @update:date-range="dateRange = $event"
            />
          </v-col>
          <v-col cols="12">
            <MoleculesFloatingTitleCard
              title="入場者"
              color="secondary"
              subtitle="クリックすると詳細表示"
            >
              <v-card-text class="d-flex ga-4 flex-wrap">
                <SiteEmployeeHistoryEmployeeChip
                  v-for="(history, index) of sortedHistories"
                  :key="index"
                  color="primary"
                  :history="history"
                  size="small"
                />
              </v-card-text>
            </MoleculesFloatingTitleCard>
          </v-col>
        </v-row>
      </v-col>

      <!-- 取極め情報 -->
      <v-col cols="12" md="4">
        <SiteEditorAgreements v-if="canWrite && isActive" :site="doc" />
        <MoleculesFloatingTitleCard v-else title="取極め" color="secondary">
          <AgreementsViewer :agreements="doc.agreementsV2" />
        </MoleculesFloatingTitleCard>
      </v-col>
    </v-row>
    </template>
  </v-container>
</template>
