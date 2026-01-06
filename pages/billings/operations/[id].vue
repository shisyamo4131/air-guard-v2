<script setup>
import dayjs from "dayjs";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useOperationBilling } from "@/composables/dataLayers/useOperationBilling";
import { useOperationBillingManager } from "@/composables/useOperationBillingManager";
import {
  DAY_TYPE_VALUES,
  SHIFT_TYPE_VALUES,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

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
  <TemplatesFixedHeightContainer>
    <v-row>
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
            <v-card>
              <template #text>
                <v-list slim>
                  <v-list-item
                    :title="`${dayjs(doc.dateAt).format(
                      'YYYY年M月D日（ddd）'
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
                      SHIFT_TYPE_VALUES?.[doc.shiftType]?.title || 'undefined'
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
            </v-card>
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
              <template #activator="{ props: activatorProps }">
                <v-card>
                  <template #title>取極め/請求情報</template>
                  <v-list slim>
                    <v-list-item
                      :title="`${
                        doc.agreement?.unitPriceBase
                          ? doc.agreement.unitPriceBase.toLocaleString() + '円'
                          : '-'
                      } / ${
                        doc.agreement?.overtimeUnitPriceBase
                          ? doc.agreement.overtimeUnitPriceBase.toLocaleString() +
                            '円'
                          : '-'
                      }`"
                      subtitle="基本単価 / 基本時間外単価"
                    />
                    <v-list-item
                      :title="`${
                        doc.agreement?.unitPriceQualified
                          ? doc.agreement.unitPriceQualified.toLocaleString() +
                            '円'
                          : '-'
                      } / ${
                        doc.agreement?.overtimeUnitPriceQualified
                          ? doc.agreement.overtimeUnitPriceQualified.toLocaleString() +
                            '円'
                          : '-'
                      }`"
                      subtitle="有資格者単価 / 有資格者時間外単価"
                    />
                  </v-list>
                  <template #actions>
                    <MoleculesActionsEdit v-bind="activatorProps" />
                  </template>
                </v-card>
              </template>
              <template #[`input.agreement`]="inputProps">
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
        <air-item-manager v-bind="attrs" :included-keys="includedKeys.adjusted">
          <template #activator="{ props: activatorProps }">
            <v-card border flat>
              <template #prepend>
                <v-chip
                  v-if="doc.useAdjustedQuantity"
                  color="warning"
                  label
                  density="compact"
                  size="small"
                  text="調整済"
                />
              </template>
              <template #title>請求明細</template>
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
              <template #actions>
                <MoleculesActionsEdit v-bind="activatorProps" />
              </template>
            </v-card>
          </template>
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
    </v-row>
  </TemplatesFixedHeightContainer>
</template>
