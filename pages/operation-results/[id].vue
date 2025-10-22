<script setup>
/**
 * @file ./pages/operation-results/[id].vue
 * @description 稼働実績詳細ページ
 */
import { OperationResult } from "@/schemas";
import { useFetchSite } from "~/composables/fetch/useFetchSite";
const { cachedSites, fetchSite } = useFetchSite();

/** Get operation-result-id from route parameters */
const route = useRoute();
const operationResultId = route.params.id;

/** define operation-result model */
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
            <MoleculesOperationResultManager
              :model-value="model"
              v-slot="{ toUpdate }"
            >
              <OperationResultsInformationCard
                :model-value="model"
                :cached-sites="cachedSites"
                @click:edit="toUpdate"
              />
            </MoleculesOperationResultManager>
          </v-col>
        </v-row>
      </v-col>
      <!-- <v-col cols="12" lg="9">
        <OperationResultsEmployeesManager :model="model" />
      </v-col> -->
      <v-col cols="12" lg="9">
        <OperationResultsWorkersManager :model-value="model.workers" />
      </v-col>
      <v-col cols="12">
        <v-alert v-if="!!model.siteOperationScheduleId"
          >稼働予定から作成された稼働実績のため削除することはできません。</v-alert
        >
      </v-col>
    </v-row>
  </v-container>
</template>
