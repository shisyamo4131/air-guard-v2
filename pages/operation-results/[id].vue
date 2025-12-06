<script setup>
import { useFetchSite } from "~/composables/fetch/useFetchSite";
import { useFetchEmployee } from "~/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "~/composables/fetch/useFetchOutsourcer";
import { useOperationResult } from "@/composables/dataLayers/useOperationResult";
import { useOperationResultManager } from "~/composables/useOperationResultManager";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
const docId = route.params.id;

// Fetch composables
const fetchSiteComposable = useFetchSite();
const fetchEmployeeComposable = useFetchEmployee();
const fetchOutsourcerComposable = useFetchOutsourcer();
provide("fetchSiteComposable", fetchSiteComposable);
provide("fetchEmployeeComposable", fetchEmployeeComposable);
provide("fetchOutsourcerComposable", fetchOutsourcerComposable);

const { doc } = useOperationResult({ docId });

// Manager composable
const { attrs, info, includedKeys, addWorker, changeWorker, removeWorker } =
  useOperationResultManager({
    doc,
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  });
</script>

<template>
  <TemplatesDetail label="稼働実績" fixed>
    <v-row>
      <v-col v-if="doc.isLocked" cols="12">
        <v-banner color="primary" icon="mdi-lock">
          <v-banner-text>
            この稼働実績は編集ロックされています。編集はできません。
          </v-banner-text>
        </v-banner>
      </v-col>
      <v-col cols="12" lg="3">
        <v-row>
          <v-col cols="12">
            <OrganismsOperationResultManager
              v-bind="attrs"
              :included-keys="includedKeys.base"
            >
              <template #activator="{ attrs: activatorProps }">
                <air-information-card
                  v-bind="activatorProps"
                  :hide-edit="doc.isLocked"
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
          :hide-action="doc.isLocked"
          :hide-create-button="doc.isLocked"
        />
      </v-col>
      <v-col cols="12">
        <AtomsAlertsWarn v-if="!!doc.siteOperationScheduleId"
          >稼働予定から作成された稼働実績です。</AtomsAlertsWarn
        >
      </v-col>
    </v-row>
  </TemplatesDetail>
</template>
