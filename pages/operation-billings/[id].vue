<script setup>
/**
 * @file ./pages/operation-billings/[id].vue
 * @description 稼働請求詳細ページ
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
      <v-col cols="12" lg="4">
        <v-row>
          <v-col cols="12">
            <MoleculesOperationBillingManager :model-value="model">
              <template #information-card="slotProps">
                <MoleculesInformationCardsOperationBilling
                  v-bind="slotProps"
                  :site="cachedSites[model.siteId]"
                />
              </template>
            </MoleculesOperationBillingManager>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="8">
        <MoleculesOperationResultManager :model-value="model">
          <v-table>
            <thead>
              <tr>
                <th>区分</th>
                <th>数量</th>
                <th>単価</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>基本人工</td>
                <td>{{ model.sales.base.quantity }}</td>
                <td>{{ model.sales.base.unitPrice }}</td>
                <td>{{ model.sales.base.regularAmount }}</td>
              </tr>
              <tr>
                <td>基本残業</td>
                <td>{{ model.sales.base.overtimeMinutes }}</td>
                <td>{{ model.sales.base.overtimeUnitPrice }}</td>
                <td>{{ model.sales.base.overtimeAmount }}</td>
              </tr>
              <tr>
                <td>資格者人工</td>
                <td>{{ model.sales.qualified.quantity }}</td>
                <td>{{ model.sales.qualified.unitPrice }}</td>
                <td>{{ model.sales.qualified.regularAmount }}</td>
              </tr>
              <tr>
                <td>資格者人工</td>
                <td>{{ model.sales.qualified.overtimeMinutes }}</td>
                <td>{{ model.sales.qualified.overtimeUnitPrice }}</td>
                <td>{{ model.sales.qualified.overtimeAmount }}</td>
              </tr>
            </tbody>
          </v-table>
        </MoleculesOperationResultManager>
      </v-col>
      <v-col cols="12">
        <MoleculesOperationResultWorkersManager
          hide-create-button
          hide-action
          :workers="model.workers"
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
