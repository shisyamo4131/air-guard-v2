<script setup>
/*****************************************************************************
 * @file ./pages/sites/[id].vue
 * @description 現場詳細ページ
 * @use useFetch (origin)
 *****************************************************************************/
import dayjs from "dayjs";
import { Employee } from "@/schemas";
import { useRoute, useRouter } from "vue-router";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useDateRange } from "@/composables/useDateRange";
import { useFetch } from "@/composables/fetch/useFetch";
import { useSiteEmployeeHistoriesBySiteId } from "@/composables/dataLayers/useSiteEmployeeHistoriesBySiteId";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "site-detail" });

/*****************************************************************************
 * ROUTER
 *****************************************************************************/
const route = useRoute();
const router = useRouter();
const docId = route.params.id;

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { doc } = useDocument("Site", { docId });

/*****************************************************************************
 * SETUP DATE RANGE COMPOSABLE
 *****************************************************************************/
const baseDate = dayjs().startOf("month").toDate();
const endDate = dayjs().endOf("month").toDate();
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
const { docs: siteEmployeeHistories } = useSiteEmployeeHistoriesBySiteId(
  docId,
  { callback: (doc) => fetchEmployee(doc.employeeId) },
);
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
    ["where", "siteId", "==", docId],
    ["where", "dateAt", ">=", debouncedDateRange.value.from],
    ["where", "dateAt", "<=", debouncedDateRange.value.to],
  ];
});
const { docs: schedules } = useDocuments("SiteOperationSchedule", {
  options,
  fetchAllOnEmpty: true,
});
</script>

<template>
  <v-container>
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" md="4">
        <v-row>
          <!-- 基本情報 -->
          <v-col cols="12">
            <SiteManager :doc="doc" label="基本情報" hide-delete-btn>
              <template #activator="activatorProps">
                <SiteActivatorBase v-bind="activatorProps">
                  <template #actions>
                    <SiteManager
                      class="flex-grow-1"
                      :doc="doc"
                      :handle-update="(item) => item.terminate()"
                      label="稼働終了"
                      hide-delete-btn
                      @submit:complete="router.replace('/sites')"
                    >
                      <template #activator="{ toUpdate }">
                        <v-btn
                          block
                          color="warning"
                          variant="flat"
                          text="稼働終了"
                          @click="() => toUpdate()"
                        />
                      </template>

                      <template #input-default>
                        <v-alert
                          type="info"
                          text="現場を稼働終了にします。よろしいですか？"
                        />
                      </template>
                    </SiteManager>
                  </template>
                </SiteActivatorBase>
              </template>
            </SiteManager>
          </v-col>

          <!-- 取引先情報 -->
          <v-col cols="12">
            <SiteManager :doc="doc" label="取引先情報" hide-delete-btn>
              <template #activator="activatorProps">
                <SiteActivatorCustomer v-bind="activatorProps" />
              </template>
            </SiteManager>
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
              :docs="schedules"
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
        <AgreementsManager
          v-model="doc.agreementsV2"
          :cutoff-date="doc.customer?.cutoffDate"
          @submit:complete="async () => await doc.update()"
        />
      </v-col>

      <!-- 削除処理ボタン -->
      <v-col cols="12">
        <site-manager
          :doc="doc"
          hide-delete-btn
          @submit:complete="() => router.replace('/sites')"
        >
          <template #activator="{ toDelete }">
            <v-btn
              block
              color="error"
              text="この現場を削除する"
              @click="() => toDelete()"
            />
          </template>
          <template #editor="{ actions: editorActions }">
            <v-card>
              <template #prepend>
                <v-icon icon="mdi-alert" color="error" />
              </template>
              <template #title> 削除処理 </template>
              <template #text>
                削除すると復元することはできません。本当に削除しますか？
              </template>
              <template #actions>
                <MoleculesActionsSubmitCancel
                  v-bind="editorActions"
                  submitText="実行"
                  color="error"
                />
              </template>
            </v-card>
          </template>
        </site-manager>
      </v-col>
    </v-row>
  </v-container>
</template>
