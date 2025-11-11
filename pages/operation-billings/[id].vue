<script setup>
import { useFetchSite } from "~/composables/fetch/useFetchSite";
import { useFetchEmployee } from "~/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "~/composables/fetch/useFetchOutsourcer";
import { useOperationBillingManager } from "~/composables/useOperationBillingManager";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// Router for getting route params
const route = useRoute();
const operationBillingId = route.params.id;

// Fetch composables
const fetchSiteComposable = useFetchSite();
const fetchEmployeeComposable = useFetchEmployee();
const fetchOutsourcerComposable = useFetchOutsourcer();
provide("fetchEmployeeComposable", fetchEmployeeComposable);
provide("fetchOutsourcerComposable", fetchOutsourcerComposable);

// Manager composable
const { doc, attrs, info } = useOperationBillingManager({
  fetchSiteComposable,
  fetchEmployeeComposable,
  fetchOutsourcerComposable,
  immediate: operationBillingId,
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="4">
        <v-row>
          <v-col cols="12">
            <air-information-card :items="info.base" hide-edit />
          </v-col>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              hide-delete-btn
              :input-props="{
                includedKeys: [
                  'unitPriceBase',
                  'overtimeUnitPriceBase',
                  'unitPriceQualified',
                  'overtimeUnitPriceQualified',
                  'billingUnitType',
                ],
              }"
            >
              <template #activator="{ attrs: activatorProps }">
                <air-information-card
                  v-bind="activatorProps"
                  :items="info.prices"
                />
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="8">
        <air-item-manager
          v-bind="attrs"
          hide-delete-btn
          :input-props="{
            includedKeys: [
              'adjustedQuantityBase',
              'adjustedOvertimeBase',
              'adjustedQuantityQualified',
              'adjustedOvertimeQualified',
              'useAdjustedQuantity',
            ],
          }"
          v-slot="{ toUpdate }"
        >
          <v-card border flat>
            <v-toolbar density="compact">
              <v-toolbar-title>
                請求明細
                <v-chip
                  v-if="doc.useAdjustedQuantity"
                  color="warning"
                  label
                  density="compact"
                  size="small"
                  text="調整済"
                />
              </v-toolbar-title>
              <v-spacer />
              <v-btn icon="mdi-pencil" @click="toUpdate()" />
            </v-toolbar>
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
                  <td>{{ doc.sales.base.quantity }}</td>
                  <td>{{ doc.sales.base.unitPrice }}</td>
                  <td>{{ doc.sales.base.regularAmount }}</td>
                </tr>
                <tr>
                  <td>基本残業</td>
                  <td>{{ doc.sales.base.overtimeMinutes }}</td>
                  <td>{{ doc.sales.base.overtimeUnitPrice }}</td>
                  <td>{{ doc.sales.base.overtimeAmount }}</td>
                </tr>
                <tr>
                  <td>資格者人工</td>
                  <td>{{ doc.sales.qualified.quantity }}</td>
                  <td>{{ doc.sales.qualified.unitPrice }}</td>
                  <td>{{ doc.sales.qualified.regularAmount }}</td>
                </tr>
                <tr>
                  <td>資格者残業</td>
                  <td>{{ doc.sales.qualified.overtimeMinutes }}</td>
                  <td>{{ doc.sales.qualified.overtimeUnitPrice }}</td>
                  <td>{{ doc.sales.qualified.overtimeAmount }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="3">合計金額</th>
                  <th>{{ doc.salesAmount }}</th>
                </tr>
                <tr>
                  <th colspan="3">消費税額</th>
                  <th>{{ doc.tax }}</th>
                </tr>
                <tr>
                  <th colspan="3">請求金額</th>
                  <th>{{ doc.billingAmount }}</th>
                </tr>
              </tfoot>
            </v-table>
          </v-card>
        </air-item-manager>
      </v-col>
      <v-col cols="12">
        <!-- 稼働実績明細は OperationResult のものでOK -->
        <OrganismsOperationResultWorkersManager
          :model-value="doc.workers"
          hide-create-button
          hide-action
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
