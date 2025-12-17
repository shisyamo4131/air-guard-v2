<script setup>
import dayjs from "dayjs";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useOperationBilling } from "@/composables/dataLayers/useOperationBilling";
import { useOperationBillingManager } from "@/composables/useOperationBillingManager";

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

// data layer composable
const { doc } = useOperationBilling({ docId: operationBillingId });

// Manager composable
const { attrs, info, includedKeys, site, toggleLock, isLoading } =
  useOperationBillingManager({
    doc,
    fetchSiteComposable,
    fetchEmployeeComposable,
    fetchOutsourcerComposable,
  });
</script>

<template>
  <TemplatesBase label="稼働請求" fixed>
    <v-row>
      <v-col cols="12">
        <v-banner v-if="doc.isLocked" color="primary" icon="mdi-lock">
          <v-banner-text>
            この稼働実績は編集ロックされています。稼働実績管理での編集ができません。
          </v-banner-text>
          <template #actions>
            <v-btn
              color="primary"
              flat
              :loading="isLoading"
              text="編集ロックを解除する"
              @click="toggleLock(doc.docId, false)"
            />
          </template>
        </v-banner>
        <v-banner v-else color="warning" icon="mdi-lock-off">
          <v-banner-text>
            この稼働実績は編集ロックされていません。稼働実績管理での編集が可能です。
          </v-banner-text>
          <template #actions>
            <v-btn
              color="warning"
              flat
              text="編集をロックする"
              @click="toggleLock(doc.docId, true)"
            />
          </template>
        </v-banner>
      </v-col>
      <v-col cols="12" lg="4">
        <v-row>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              :included-keys="[
                {
                  key: 'siteId',
                  title: '現場名',
                  value: (item) =>
                    fetchSiteComposable.cachedSites.value?.[item.siteId]
                      ?.name || 'loading...',
                  editable: false,
                },
                {
                  key: 'dateAt',
                  value: (item) =>
                    dayjs(item.dateAt).format('YYYY年M月D日（ddd）'),
                },
                'dayType',
                'shiftType',
                'startTime',
                'endTime',
                'breakMinutes',
                'workDescription',
                'remarks',
              ]"
            >
              <template #activator="{ attrs: activatorProps, displayItems }">
                <air-card popup color="primary">
                  <template #title>基本情報</template>
                  <template #text>
                    <v-list :items="displayItems"> </v-list>
                  </template>
                </air-card>
              </template>
            </air-item-manager>
          </v-col>
          <v-col cols="12">
            <air-item-manager
              v-bind="attrs"
              label="取極め/請求情報編集"
              :dialog-props="{ maxWidth: '720' }"
              :included-keys="[
                {
                  key: 'unitPrice',
                  title: '基本単価',
                  value: (item) =>
                    item.agreement ? item.agreement.unitPriceBase : '-',
                  editable: false,
                },
                {
                  key: 'overtimeUnitPriceBase',
                  title: '基本時間外単価',
                  value: (item) =>
                    item.agreement ? item.agreement.overtimeUnitPriceBase : '-',
                  editable: false,
                },
                {
                  key: 'unitPriceQualified',
                  title: '有資格者単価',
                  value: (item) =>
                    item.agreement ? item.agreement.unitPriceQualified : '-',
                  editable: false,
                },
                {
                  key: 'overtimeUnitPriceQualified',
                  title: '有資格者時間外単価',
                  value: (item) =>
                    item.agreement
                      ? item.agreement.overtimeUnitPriceQualified
                      : '-',
                  editable: false,
                },
                { key: 'agreement', display: false },
                {
                  key: 'billingDateAt',
                  value: (item) =>
                    item.billingDateAt
                      ? dayjs(item.billingDateAt).format('YYYY年M月D日')
                      : '',
                  editable: false,
                },
              ]"
            >
              <template #activator="{ attrs: activatorProps, displayItems }">
                <air-card popup color="primary">
                  <template #title>取極め/請求情報</template>
                  <template #text>
                    <v-list :items="displayItems"></v-list>
                  </template>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </air-card>
              </template>
              <template #input.agreement="inputProps">
                <MoleculesAgreementGroup
                  v-bind="inputProps.attrs"
                  clearable
                  :items="site?.agreements || []"
                />
              </template>
              <template #after-agreement="inputProps">
                <v-col cols="12">
                  <v-expand-transition>
                    <air-checkbox
                      v-if="!inputProps.item.hasAgreement"
                      :model-value="inputProps.item.allowEmptyAgreement"
                      label="取極めなしを許容する"
                      hint="許容しない場合売上や請求として計上されません。"
                      persistent-hint
                      @update:modelValue="
                        inputProps.updateProperties({
                          allowEmptyAgreement: $event,
                        })
                      "
                    />
                  </v-expand-transition>
                </v-col>
                <v-col cols="12">
                  <air-date-input
                    :model-value="inputProps.item.billingDateAt"
                    label="請求締日"
                    :required="
                      inputProps.item.isInvalid === 'EMPTY_BILLING_DATE'
                    "
                    @update:modelValue="
                      inputProps.updateProperties({ billingDateAt: $event })
                    "
                  />
                </v-col>
              </template>
            </air-item-manager>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="8">
        <air-item-manager
          v-bind="attrs"
          :included-keys="includedKeys.adjusted"
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
  </TemplatesBase>
</template>
