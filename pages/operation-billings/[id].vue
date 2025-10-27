<script setup>
/**
 * @file ./pages/operation-billings/[id].vue
 * @description 稼働請求詳細ページ
 */
import { OperationBilling } from "@/schemas";
import dayjs from "dayjs";
import { useFetchSite } from "~/composables/fetch/useFetchSite";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { cachedSites, fetchSite } = useFetchSite();
const route = useRoute();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const operationResultId = route.params.id;
const model = reactive(new OperationBilling());

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => model,
  (newModel) => fetchSite(newModel.siteId),
  { immediate: true, deep: true }
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  model.subscribe({ docId: operationResultId });
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" lg="4">
        <v-row>
          <v-col cols="12">
            <air-information-card
              class="v-list--info-display"
              label="基本情報"
              hide-edit
              :items="[
                {
                  title: '現場名',
                  props: {
                    subtitle: cachedSites[model.siteId]?.name || 'loading...',
                  },
                },
                {
                  title: '日付',
                  props: {
                    subtitle: dayjs(model.dateAt).format('YYYY年M月D日（ddd）'),
                  },
                },
                {
                  title: '区分',
                  props: {
                    subtitle: `${OperationBilling.DAY_TYPE[model.dayType]} ${
                      OperationBilling.SHIFT_TYPE[model.shiftType].title
                    }`.trim(),
                  },
                },
                {
                  title: '時間',
                  props: {
                    subtitle: `${model.startTime} - ${model.endTime}`.trim(),
                  },
                },
                {
                  title: '作業内容',
                  props: { subtitle: model.workDescription },
                },
                { title: '備考', props: { subtitle: model.remarks } },
              ]"
            />
          </v-col>
          <v-col cols="12">
            <MoleculesOperationBillingManager
              :model-value="model"
              :editor-props="{
                hideDeleteBtn: true,
              }"
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
              <template #activator="{ attrs }">
                <air-information-card
                  v-bind="attrs"
                  class="v-list--info-display"
                  label="単価情報"
                  :items="[
                    {
                      title: '基本単価',
                      props: {
                        subtitle: `${model.unitPriceBase}円/${model.overtimeUnitPriceBase}円`,
                      },
                    },
                    {
                      title: '資格者単価',
                      props: {
                        subtitle: `${model.unitPriceQualified}円/${model.overtimeUnitPriceQualified}円`,
                      },
                    },
                  ]"
                />
              </template>
            </MoleculesOperationBillingManager>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="8">
        <MoleculesOperationBillingManager
          :model-value="model"
          :editor-props="{
            hideDeleteBtn: true,
          }"
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
                  v-if="model.useAdjustedQuantity"
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
                  <td>{{ model.sales.base.quantity }}</td>
                  <td>{{ model.sales.base.unitPrice }}</td>
                  <td>{{ model.sales.base.regularAmount }}</td>
                </tr>
                <tr>
                  <td>基本残業</td>
                  <td>{{ model.sales.base.overtimeMinutes }}</td>
                  <td>{{ model.sales.base.overtimeUnitPrice }}</td>
                  <td>{{ model.sales.base.overtimeAmount }}</td>
                </tr>
                <tr>
                  <td>資格者人工</td>
                  <td>{{ model.sales.qualified.quantity }}</td>
                  <td>{{ model.sales.qualified.unitPrice }}</td>
                  <td>{{ model.sales.qualified.regularAmount }}</td>
                </tr>
                <tr>
                  <td>資格者残業</td>
                  <td>{{ model.sales.qualified.overtimeMinutes }}</td>
                  <td>{{ model.sales.qualified.overtimeUnitPrice }}</td>
                  <td>{{ model.sales.qualified.overtimeAmount }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="3">合計金額</th>
                  <th>{{ model.salesAmount }}</th>
                </tr>
                <tr>
                  <th colspan="3">消費税額</th>
                  <th>{{ model.tax }}</th>
                </tr>
                <tr>
                  <th colspan="3">請求金額</th>
                  <th>{{ model.billingAmount }}</th>
                </tr>
              </tfoot>
            </v-table>
          </v-card>
        </MoleculesOperationBillingManager>
      </v-col>
      <v-col cols="12">
        <!-- 稼働実績明細は OperationResult のものでOK -->
        <MoleculesOperationResultWorkersManager
          hide-create-button
          hide-action
          :workers="model.workers"
        />
      </v-col>
      <v-col cols="12">
        <AtomsAlertsWarn v-if="!!model.siteOperationScheduleId"
          >稼働予定から作成された稼働実績です。</AtomsAlertsWarn
        >
      </v-col>
    </v-row>
  </v-container>
</template>
