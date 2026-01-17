<script setup>
/*****************************************************************************
 * 現場稼働予定管理
 *****************************************************************************/
import dayjs from "dayjs";
import { useDateRange } from "@/composables/useDateRange";
import { useDocuments } from "@/composables/dataLayers/useDocuments";
import { useSiteOperationScheduleManager } from "@/composables/useSiteOperationScheduleManager";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/** SETUP STORES */
const auth = useAuthStore();

/** SETUP COMPOSABLES */
const { fetchSite, cachedSites } = useFetchSite();
const { dateRange } = useDateRange({ dayCount: 60 });
const subscribeOptions = computed(() => [
  ["where", "dateAt", ">=", dateRange.value.from],
  ["where", "dateAt", "<=", dateRange.value.to],
]);
const { docs } = useDocuments("SiteOperationSchedule", {
  options: subscribeOptions,
  fetchAllOnEmpty: true,
});
const manager = useSiteOperationScheduleManager();

/** SETUP STATES */
const selectedDateAt = ref(null);
const selectedSiteId = ref(null);
const selectedShiftType = ref(null);
const selectedGroupKey = ref(null);
const scheduleSelectDialog = ref(false);

const selectedSchedules = computed(() => {
  return docs.filter(({ groupKey }) => groupKey === selectedGroupKey.value);
});

/**
 * SiteOperationSchedule ドキュメントをテーブル表示用にマップデータに変換して返します。
 */
const schedulesByGroupKeyMap = computed(() => {
  const result = new Map();
  docs.forEach((schedule) => {
    if (!result.has(schedule.groupKey)) {
      result.set(schedule.groupKey, {
        total: schedule.requiredPersonnel,
        count: 1,
        schedules: [schedule],
        hasMultiple: false,
      });
    } else {
      const existing = result.get(schedule.groupKey);
      existing.total += schedule.requiredPersonnel;
      existing.count += 1;
      existing.schedules.push(schedule);
      existing.hasMultiple = existing.count > 1;
      result.set(schedule.groupKey, existing);
    }
  });
  return result;
});

function handleClickCell({ siteId, shiftType, dateAt, groupKey }) {
  selectedSiteId.value = siteId;
  selectedShiftType.value = shiftType;
  selectedDateAt.value = dateAt;
  selectedGroupKey.value = groupKey;
  scheduleSelectDialog.value = true;
}

onMounted(() => {
  // 現場データを事前取得
  auth.company.siteOrder.forEach((order) => {
    fetchSite(order.siteId);
  });
});
</script>

<template>
  <div class="d-flex fill-height">
    <!-- メインコンテンツ: テーブル -->
    <MoleculesSiteOperationScheduleTable
      :start-date="dateRange.from"
      :end-date="dateRange.to"
      day-format="MM/DD"
      :day-height="36"
      :site-order="auth.company.siteOrder"
      :weekday-height="36"
    >
      <template #site-order="{ siteId, shiftType }">
        <div class="py-1 d-flex align-center">
          <AtomsChipsShiftType
            :shift-type="shiftType"
            class="mr-2"
            density="compact"
          />
          {{ cachedSites[siteId]?.name || "...loading" }}
        </div>
      </template>
      <template #cell="{ siteId, shiftType, dateAt, groupKey }">
        <div class="py-2 d-flex justify-center">
          <v-badge
            :model-value="
              schedulesByGroupKeyMap.get(groupKey)?.hasMultiple || false
            "
            :content="schedulesByGroupKeyMap.get(groupKey)?.count"
            color="info"
          >
            <v-chip
              :text="schedulesByGroupKeyMap.get(groupKey)?.total || '-'"
              size="small"
              @click="
                () => handleClickCell({ siteId, shiftType, dateAt, groupKey })
              "
            />
          </v-badge>
        </div>
      </template>
    </MoleculesSiteOperationScheduleTable>

    <!-- 現場稼働予定選択コンポーネント -->
    <!-- 一つのセルに複数の現場稼働予定が存在する場合に、その選択が行えるようにするコンポーネント -->
    <AtomsDialogsFullscreen v-model="scheduleSelectDialog" max-width="480">
      <template #default>
        <v-card>
          <template #prepend>
            <AtomsChipsShiftType :shift-type="selectedShiftType" />
          </template>
          <template #title>
            {{ cachedSites[selectedSiteId]?.name || "...loading" }}
          </template>
          <template #subtitle>
            {{ dayjs(selectedDateAt).format("YYYY年MM月DD日(ddd)") }}
          </template>
          <template #append>
            <v-icon icon="mdi-close" @click="scheduleSelectDialog = false" />
          </template>
          <template #text>
            <v-list v-if="selectedSchedules.length > 0" class="py-0" border>
              <template
                v-for="(schedule, index) in selectedSchedules"
                :key="index"
              >
                <v-list-item>
                  <v-list-item-title>
                    <div class="d-flex align-center">
                      <AtomsIconsHasLicense
                        v-if="schedule.qualificationRequired"
                        class="mr-1"
                      />
                      {{ schedule.workDescription || "通常警備" }}
                    </div>
                  </v-list-item-title>
                  <v-list-item-subtitle class="mb-1">
                    必要人員数: {{ schedule.requiredPersonnel }}
                  </v-list-item-subtitle>
                  <v-list-item-subtitle class="mb-1">
                    時間: {{ schedule.startTime }} 〜 {{ schedule.endTime }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-list-item-action>
                      <v-btn
                        icon="mdi-pencil"
                        @click="
                          () => {
                            manager.toUpdate(schedule);
                          }
                        "
                      />
                    </v-list-item-action>
                  </template>
                </v-list-item>
                <v-divider v-if="index < selectedSchedules.length - 1" />
              </template>
            </v-list>
            <v-empty-state
              v-else
              icon="mdi-alert-circle-outline"
              title="現場稼働予定は登録されていません"
            />
          </template>
          <template #actions>
            <div class="d-flex justify-end">
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                text="新規作成"
                @click="
                  () => {
                    manager.toCreate({
                      siteId: selectedSiteId,
                      shiftType: selectedShiftType,
                      dateAt: selectedDateAt,
                    });
                  }
                "
              />
            </div>
          </template>
        </v-card>
      </template>
    </AtomsDialogsFullscreen>

    <!-- 現場稼働予定編集用コンポーネント -->
    <OrganismsSiteOperationScheduleManager
      v-bind="manager.attrs.value"
      :excluded-keys="['employees', 'outsourcers']"
    />
  </div>
</template>
