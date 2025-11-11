<script setup>
import { useFetchSite } from "~/composables/fetch/useFetchSite";
import { useOperationResultManager } from "~/composables/useOperationResultManager";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
const operationResultId = route.params.id;

// Fetch site composables
const fetchSiteComposable = useFetchSite();
const { searchSites, getSite } = fetchSiteComposable;

// Manager composable
const { doc, attrs, info, addWorker, changeWorker, removeWorker } =
  useOperationResultManager({
    fetchSiteComposable,
    immediate: operationResultId,
  });
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="3">
        <v-row>
          <v-col cols="12">
            <OrganismsOperationResultManager
              v-bind="attrs"
              :get-site="getSite"
              :search-sites="searchSites"
            >
              <template #activator="{ attrs: activatorProps }">
                <air-information-card
                  v-bind="activatorProps"
                  :items="info.base"
                />
              </template>
            </OrganismsOperationResultManager>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="9">
        <MoleculesOperationResultWorkersManager
          :workers="doc.workers"
          :handle-create="addWorker"
          :handle-update="changeWorker"
          :handle-delete="removeWorker"
        />
      </v-col>
      <v-col cols="12">
        <AtomsAlertsWarn v-if="!!doc.siteOperationScheduleId"
          >稼働予定から作成された稼働実績です。</AtomsAlertsWarn
        >
      </v-col>
    </v-row>
  </v-container>
</template>
