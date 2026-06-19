<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Generator/Detail.vue
 * @description `OperationResultGenerator` 専用 `SiteOperationSchedule` 詳細表示コンポーネント
 * - `loading` はスロットプロパティのため inject 不可能。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  loading: { type: Boolean, default: false },
});
const props = useDefaults(_props, "OperationResultGeneratorDetail");
const emit = defineEmits(["click:submit"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("SiteOperationScheduleTable");
const { cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * INJECT
 *****************************************************************************/
const selectedSchedule = inject("selectedSchedule", null); // From index.vue
const notifications = inject("notifications", []); // From index.vue
const notificationsMap = inject("notificationsMap", {}); // From index.vue

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/

/**
 * 仮登録現場であるかどうかを返します。
 * - `cachedSites` に現場情報が読み込めない場合、仮登録現場とみなします。
 */
const isTemporarySite = computed(() => {
  return cachedSites.value[selectedSchedule.value?.siteId]?.isTemporary;
});
</script>

<template>
  <v-card class="d-flex flex-column flex-grow-1">
    <v-toolbar
      class="flex-grow-0"
      color="secondary"
      density="compact"
      title="現場稼働詳細"
    />
    <v-card-text v-if="selectedSchedule" class="flex-grow-1 overflow-y-auto">
      <div class="d-flex flex-wrap fill-height ga-4">
        <SiteOperationScheduleTable
          v-if="selectedSchedule"
          class="mb-4 flex-grow-1"
          :arrangement-notifications="notifications"
          :schedule="selectedSchedule"
        >
          <template #append-header>
            <th>action</th>
          </template>
          <template #append="{ worker }">
            <td>
              <!-- 上下番確定処理では配置通知のステータスは `下番済み` に強制更新 -->
              <!-- `excluded-keys` によりステータス編集コンポーネントを非表示化（CustomInput で対応） -->
              <ArrangementNotificationManager
                :doc="notificationsMap[worker.notificationKey]"
                :before-edit="(editMode, item) => (item.status = 'LEAVED')"
              >
                <template #activator="activatorProps">
                  <v-btn
                    icon="mdi-pencil"
                    @click="() => activatorProps.toUpdate()"
                    size="small"
                  />
                </template>
              </ArrangementNotificationManager>
            </td>
          </template>
        </SiteOperationScheduleTable>
        <v-card class="d-flex flex-column flex-grow-1" style="min-width: 360px">
          <SecurityReportsManager
            class="flex-grow-1"
            :schedule-id="selectedSchedule?.docId"
          />
        </v-card>
      </div>
    </v-card-text>
    <v-empty-state
      v-else
      title="現場稼働を選択してください。"
      icon="mdi-alert-circle-outline"
    />
    <v-card-actions v-if="selectedSchedule" class="flex-grow-0 justify-end">
      <v-btn
        text="上下番を確定する"
        :loading="props.loading"
        :disabled="props.loading || isTemporarySite"
        variant="flat"
        block
        color="primary"
        @click="emit('click:submit', selectedSchedule)"
      />
    </v-card-actions>
  </v-card>
</template>
