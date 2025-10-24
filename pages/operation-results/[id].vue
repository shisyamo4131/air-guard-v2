<script setup>
/**
 * @file ./pages/operation-results/[id].vue
 * @description 稼働実績詳細ページ
 */
import { OperationResult } from "@/schemas";
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
              <template #information-card="slotProps">
                <MoleculesInformationCardsOperationResult
                  v-bind="slotProps"
                  :site="cachedSites[model.siteId]"
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
