<script setup>
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const route = useRoute();
const docId = route.params.id;
const {
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  fetchArticleComposable,
} = useFetch("OperationBilling", true);
const { fetchSite } = fetchSiteComposable;
const { fetchEmployee } = fetchEmployeeComposable;
const { fetchOutsourcer } = fetchOutsourcerComposable;
const { fetchArticle } = fetchArticleComposable;
const { doc } = useDocument("OperationBilling", { docId }, (doc) => {
  if (!doc?.docId) return;
  fetchSite(doc.siteId);
  fetchEmployee(doc.employeeIds);
  fetchOutsourcer(doc.outsourcerIds);
  fetchArticle(doc.articles);
});
</script>

<template>
  <v-container class="fill-height align-start">
    <v-row>
      <!-- LEFT SIDE -->
      <v-col cols="12" lg="3">
        <v-row>
          <!-- 稼働概要 -->
          <v-col cols="12">
            <OperationBillingManager
              :doc="doc"
              label="稼働概要"
              hide-delete-btn
            >
              <template #activator="activatorProps">
                <OperationBillingActivatorBase v-bind="activatorProps" />
              </template>
            </OperationBillingManager>
          </v-col>
          <v-col cols="12">
            <v-card>
              <v-toolbar color="secondary" density="compact" title="警備日報" />
              <SecurityReportsManager :schedule-id="doc?.docId" />
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" lg="9">
        <v-row>
          <!-- 取極め・請求締日 -->
          <v-col cols="12" lg="4">
            <OperationBillingManager
              class="fill-height"
              :doc="doc"
              label="取極め"
              hide-delete-btn
            >
              <template #activator="activatorProps">
                <OperationBillingActivatorAgreement
                  v-bind="activatorProps"
                  class="fill-height"
                />
              </template>
            </OperationBillingManager>
          </v-col>
          <v-col cols="12" lg="8">
            <OperationBillingManager
              :doc="doc"
              label="請求明細"
              hide-delete-btn
            >
              <template #activator="activatorProps">
                <OperationBillingActivatorBillingItems
                  v-bind="activatorProps"
                />
              </template>
            </OperationBillingManager>
          </v-col>
          <v-col v-if="doc.isBillable" cols="12">
            <ArticleDetailsManager
              v-model="doc.articles"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
          <v-col cols="12">
            <OperationResultWorkersManager
              :model-value="doc.workers"
              disabled
              :table-props="{ hideAction: true }"
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
