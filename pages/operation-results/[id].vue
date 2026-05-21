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
} = useFetch("OperationResult", true);
const { fetchSite } = fetchSiteComposable;
const { fetchEmployee } = fetchEmployeeComposable;
const { fetchOutsourcer } = fetchOutsourcerComposable;
const { doc } = useDocument("OperationResult", { docId }, (doc) => {
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
          <!-- 基本情報 -->
          <v-col cols="12">
            <OperationResultManager :doc="doc" label="基本情報" hide-delete-btn>
              <template #activator="activatorProps">
                <OperationResultActivatorBase
                  v-bind="activatorProps"
                  :disabled="doc.isLocked"
                />
              </template>
            </OperationResultManager>
          </v-col>
        </v-row>
      </v-col>

      <!-- RIGHT SIDE -->
      <v-col cols="12" lg="9">
        <v-row>
          <v-col cols="12">
            <OperationResultWorkersManager
              v-model="doc.workers"
              :disabled="doc.isLocked"
              @submit:complete="async () => await doc.update()"
            />
          </v-col>
          <v-col cols="12">
            <v-card>
              <v-toolbar color="secondary" density="compact" title="警備日報" />
              <SecurityReportsManager :schedule-id="doc?.docId" />
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>
