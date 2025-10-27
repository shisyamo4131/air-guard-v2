<script setup>
/**
 * @file ./pages/operation-results/[id].vue
 * @description 稼働実績詳細ページ
 */
import { OperationResult } from "@/schemas";
import dayjs from "dayjs";
import { useFetchSite } from "~/composables/fetch/useFetchSite";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { cachedSites, fetchSite } = useFetchSite();
const route = useRoute();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const operationResultId = route.params.id;
const model = reactive(new OperationResult());

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => model,
  (newModel) => fetchSite(newModel.siteId),
  { immediate: true, deep: true }
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function handleWorkerCreated(item) {
  model.addWorker(item, -1);
  await model.update();
}
async function handleWorkerUpdated(item) {
  model.changeWorker(item);
  await model.update();
}
async function handleWorkerDeleted(item) {
  model.removeWorker(item);
  await model.update();
}
/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  model.subscribe({ docId: operationResultId });
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="3">
        <v-row>
          <v-col cols="12">
            <MoleculesOperationResultManager :model-value="model">
              <template #activator="{ attrs }">
                <air-information-card
                  v-bind="attrs"
                  class="v-list--info-display"
                  :items="[
                    { title: 'CODE', props: { subtitle: model.code } },
                    {
                      title: '現場名',
                      props: {
                        subtitle:
                          cachedSites[model.siteId]?.name || 'loading...',
                      },
                    },
                    {
                      title: '日付',
                      props: {
                        subtitle: dayjs(model.dateAt).format(
                          'YYYY年M月D日（ddd）'
                        ),
                      },
                    },
                    {
                      title: '区分',
                      props: {
                        subtitle: `${
                          OperationResult.DAY_TYPE[model.dayType] ||
                          'loading...'
                        } ${
                          OperationResult.SHIFT_TYPE[model.shiftType]?.title ||
                          'loading...'
                        }`.trim(),
                      },
                    },
                    {
                      title: '時間',
                      props: {
                        subtitle: `${model.startTime || 'loading...'} - ${
                          model.endTime || 'loading...'
                        }`.trim(),
                      },
                    },
                    {
                      title: '作業内容',
                      props: { subtitle: model.workDescription },
                    },
                    { title: '備考', props: { subtitle: model.remarks } },
                  ]"
                />
              </template>
            </MoleculesOperationResultManager>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="9">
        <MoleculesOperationResultWorkersManager
          :workers="model.workers"
          :handle-create="handleWorkerCreated"
          :handle-update="handleWorkerUpdated"
          :handle-delete="handleWorkerDeleted"
        />
      </v-col>
      <v-col cols="12">
        <AtomsAlertsWarn v-if="!!model.siteOperationScheduleId"
          >稼働予定から作成された稼働実績です。</AtomsAlertsWarn
        >
      </v-col>
    </v-row>
  </v-container>
</template>
