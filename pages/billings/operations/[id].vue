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
} = useFetch("OperationBilling", true);
const { fetchSite } = fetchSiteComposable;
const { fetchEmployee } = fetchEmployeeComposable;
const { fetchOutsourcer } = fetchOutsourcerComposable;
const { doc } = useDocument("OperationBilling", { docId }, (doc) => {
  fetchSite(doc.siteId);
  fetchEmployee(doc.employeeIds);
  fetchOutsourcer(doc.outsourcerIds);
});
</script>

<template>
  <v-container class="fill-height align-start">
    <v-row>
      <v-col v-if="doc.isLocked" cols="12">
        <v-alert
          color="warning"
          icon="mdi-lock"
          density="compact"
          text="この稼働実績は編集ロックされています。編集はできません。"
        >
        </v-alert>
      </v-col>
      <!-- LEFT SIDE -->
      <v-col cols="12" lg="3">
        <v-row>
          <!-- 稼働概要 -->
          <v-col cols="12">
            <OperationBillingManager :doc="doc" label="稼働概要" hide-edit-btn>
              <template #activator="activatorProps">
                <OperationBillingActivatorBase
                  v-bind="activatorProps"
                  :disabled="doc.isLocked"
                />
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
          <v-col cols="12">
            <OperationBillingManager
              class="mb-4"
              :doc="doc"
              label="請求情報"
              hide-delete-btn
            >
              <template #activator="activatorProps">
                <OperationBillingActivatorBillingItems
                  v-bind="activatorProps"
                />
              </template>
            </OperationBillingManager>
            <v-alert
              v-if="!doc.isBillable"
              density="compact"
              type="error"
              text="取極め、または数量・単価調整が行われていないため、請求データが作成されません。"
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
