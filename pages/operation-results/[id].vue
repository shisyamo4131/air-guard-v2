<script setup>
import { useFetchSite } from "~/composables/fetch/useFetchSite";
import { useFetchEmployee } from "~/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "~/composables/fetch/useFetchOutsourcer";
import { useOperationResultManager } from "~/composables/useOperationResultManager";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
const operationResultId = route.params.id;

// Fetch composables
const fetchSiteComposable = useFetchSite();
const fetchEmployeeComposable = useFetchEmployee();
const fetchOutsourcerComposable = useFetchOutsourcer();
provide("fetchSiteComposable", fetchSiteComposable);
provide("fetchEmployeeComposable", fetchEmployeeComposable);
provide("fetchOutsourcerComposable", fetchOutsourcerComposable);

// Manager composable
const {
  doc,
  attrs,
  info,
  includedKeys,
  addWorker,
  changeWorker,
  removeWorker,
} = useOperationResultManager({
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
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
              :input-props="{
                includedKeys: includedKeys.base,
              }"
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
        <OrganismsOperationResultWorkersManager
          :model-value="doc.workers"
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
