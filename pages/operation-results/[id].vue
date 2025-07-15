<script setup>
/**
 * @file ./pages/operation-results/[id].vue
 * @description 稼働実績詳細ページ
 * - ルートパラメータ [id] は OperationResults コレクションのドキュメント id
 * - ドキュメント id をもとに OperationResult クラスからドキュメント情報を取得して表示
 */
import dayjs from "dayjs";
import { OperationResult } from "~/schemas";
import { DAY_TYPE, SHIFT_TYPE } from "air-guard-v2-schemas/constants";
import { useFetchSite } from "~/composables/useFetchSite";

/** Get operation-result-id from route parameters */
const route = useRoute();
const operationResultId = route.params.id;

/** define operation-result model */
const model = reactive(new OperationResult());

/** Fetch site information */
const { cachedSites, fetchSite } = useFetchSite();

watch(() => model.siteId, fetchSite);

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(async () => {
  await model.subscribe({ docId: operationResultId });
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
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>稼働概要</v-toolbar-title>
                <v-spacer />
                <ItemManager
                  :model="model"
                  label="稼働概要修正"
                  :disable-delete="!!model.siteOperationScheduleId"
                  :input-props="{
                    includedKeys: ['siteId', 'dateAt', 'dayType', 'shiftType'],
                  }"
                >
                </ItemManager>
              </v-toolbar>
              <v-list>
                <v-list-item>
                  <v-list-item-subtitle>現場</v-list-item-subtitle>
                  <v-list-item-title>{{
                    cachedSites[model.siteId]?.name || "loading..."
                  }}</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>日付</v-list-item-subtitle>
                  <v-list-item-title>{{
                    dayjs(model.dateAt).format("YYYY年M月D日（ddd）")
                  }}</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>区分</v-list-item-subtitle>
                  <v-list-item-title
                    >{{ DAY_TYPE[model.dayType] }}
                    {{ SHIFT_TYPE[model.shiftType] }}</v-list-item-title
                  >
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>請求単価</v-toolbar-title>
                <v-spacer />
                <ItemManager
                  :model="model"
                  :editor-props="{
                    hideDeleteBtn: true,
                  }"
                  label="請求単価修正"
                  :input-props="{
                    includedKeys: [
                      'unitPrice',
                      'overTimeUnitPrice',
                      'unitPriceQualified',
                      'overTimeUnitPriceQualified',
                    ],
                  }"
                >
                </ItemManager>
              </v-toolbar>
              <v-list>
                <v-list-item>
                  <v-list-item-subtitle>基本単価</v-list-item-subtitle>
                  <v-list-item-title>16,000円/2,500円</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>資格者単価</v-list-item-subtitle>
                  <v-list-item-title>18,000円/2,820円</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="8">
        <OperationResultsEmployeesManager :model="model" />
      </v-col>
    </v-row>
  </v-container>
</template>
