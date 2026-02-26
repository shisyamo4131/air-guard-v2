<script setup>
import dayjs from "dayjs";
import { useDocument } from "@/composables/dataLayers/useDocument";
import { useFetchSite } from "~/composables/fetch/useFetchSite";
import { useFetchEmployee } from "~/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "~/composables/fetch/useFetchOutsourcer";
import { useOperationResultManager } from "~/composables/useOperationResultManager";
import {
  DAY_TYPE_VALUES,
  SHIFT_TYPE_VALUES,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
const docId = route.params.id;

const { doc } = useDocument("OperationResult", { docId });

// Fetch composables
const fetchSiteComposable = useFetchSite();
const fetchEmployeeComposable = useFetchEmployee();
const fetchOutsourcerComposable = useFetchOutsourcer();
provide("fetchSiteComposable", fetchSiteComposable);
provide("fetchEmployeeComposable", fetchEmployeeComposable);
provide("fetchOutsourcerComposable", fetchOutsourcerComposable);

// Manager composable
const { attrs, addWorker, changeWorker, removeWorker } =
  useOperationResultManager({
    doc,
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  });
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-row>
      <v-col v-if="doc.isLocked" cols="12">
        <v-banner color="primary" icon="mdi-lock">
          <v-banner-text>
            この稼働実績は編集ロックされています。編集はできません。
          </v-banner-text>
        </v-banner>
      </v-col>
      <v-col cols="12">
        <v-card>
          <template #title>
            {{
              `${
                fetchSiteComposable.cachedSites.value?.[doc.siteId]?.name ||
                "loading..."
              }`
            }}
          </template>
        </v-card>
      </v-col>
      <v-col cols="12" lg="3">
        <v-row>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              disable-update
              :included-keys="[
                'siteId',
                'dateAt',
                'dayType',
                'shiftType',
                'startTime',
                'endTime',
                'breakMinutes',
                'workDescription',
                'remarks',
              ]"
            >
              <template #activator="{ props: activatorProps }">
                <v-card>
                  <template #text>
                    <v-list slim>
                      <v-list-item
                        :title="`${dayjs(doc.dateAt).format(
                          'YYYY年M月D日（ddd）',
                        )}`"
                        subtitle="日付"
                      />
                      <v-list-item
                        :title="`${
                          DAY_TYPE_VALUES?.[doc.dayType]?.title || 'undefined'
                        }`"
                        subtitle="曜日区分"
                      />
                      <v-list-item
                        :title="`${
                          SHIFT_TYPE_VALUES?.[doc.shiftType]?.title ||
                          'undefined'
                        }`"
                        subtitle="勤務区分"
                      />
                      <v-list-item
                        :title="`${doc.startTime} - ${doc.endTime}`"
                        subtitle="定時勤務時間"
                      />
                      <v-list-item
                        :title="`${doc.breakMinutes}`"
                        subtitle="休憩時間（分）"
                      />
                      <v-list-item
                        :title="`${doc.workDescription || '-'}`"
                        subtitle="作業内容"
                      />
                    </v-list>
                    <v-card v-if="doc.remarks" :text="doc.remarks" />
                  </template>
                  <template v-if="!activatorProps.disableUpdate" #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
              <template #[`input.siteId`]="inputAttrs">
                <MoleculesAutocompleteSite
                  v-bind="inputAttrs.attrs"
                  :fetch-site-composable="fetchSiteComposable"
                  clearable
                  :disabled="inputAttrs.editMode !== 'CREATE'"
                />
              </template>
            </air-item-manager>
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
  </TemplatesFixedHeightContainer>
</template>
