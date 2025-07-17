<script setup>
/**
 * @file ./pages/operation-results/[id].vue
 * @description 稼働実績詳細ページ
 * - ルートパラメータ [id] は OperationResults コレクションのドキュメント id
 * - ドキュメント id をもとに OperationResult クラスからドキュメント情報を取得して表示
 */
import dayjs from "dayjs";
import { OperationResult } from "~/schemas";
import {
  DAY_TYPE,
  SHIFT_TYPE,
  SITE_OPERATION_SCHEDULE,
  getDayType,
} from "air-guard-v2-schemas/constants";
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
      <v-col cols="12" lg="3">
        <v-row>
          <v-col cols="12">
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>稼働概要</v-toolbar-title>
                <v-spacer />
                <ItemManager
                  :model="model"
                  label="稼働概要修正"
                  :dialog-props="{ maxWidth: 600 }"
                  :disable-delete="!!model.siteOperationScheduleId"
                  :input-props="{
                    excludedKeys: [
                      'status',
                      'workDescription',
                      'remarks',
                      'employees',
                      'outsourcers',
                    ],
                  }"
                >
                  <template #input="inputProps">
                    <air-item-input v-bind="inputProps">
                      <template #dateAt="{ attrs }">
                        <air-date-input
                          v-bind="attrs"
                          @update:modelValue="
                            inputProps.updateProperties({
                              dayType: getDayType($event),
                            })
                          "
                        />
                      </template>
                    </air-item-input>
                  </template>
                </ItemManager>
              </v-toolbar>
              <v-list>
                <v-list-item>
                  <v-list-item-subtitle>ステータス</v-list-item-subtitle>
                  <v-list-item-title>{{
                    SITE_OPERATION_SCHEDULE[model.status] || "不明"
                  }}</v-list-item-title>
                </v-list-item>
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
                <v-list-item>
                  <v-list-item-subtitle>時間</v-list-item-subtitle>
                  <v-list-item-title>
                    {{ `${model.startTime} - ${model.endTime}` }}
                  </v-list-item-title>
                  <v-list-item-title class="text-subtitle-2">
                    {{
                      `(実働: ${model.regulationWorkMinutes}分 休憩: ${model.breakMinutes}分)`
                    }}
                  </v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>基本単価</v-list-item-subtitle>
                  <v-list-item-title>{{
                    `${(model.unitPrice || 0).toLocaleString()}円/${(
                      model.overTimeUnitPrice || 0
                    ).toLocaleString()}円`
                  }}</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>資格者単価</v-list-item-subtitle>
                  <v-list-item-title>{{
                    `${(model.unitPriceQualified || 0).toLocaleString()}円/${(
                      model.overTimeUnitPriceQualified || 0
                    ).toLocaleString()}円`
                  }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>説明</v-toolbar-title>
                <v-spacer />
                <ItemManager
                  :model="model"
                  label="稼働概要修正"
                  :dialog-props="{ maxWidth: 600 }"
                  :editor-props="{ hideDeleteBtn: true }"
                  :input-props="{
                    includedKeys: ['workDescription', 'remarks'],
                  }"
                >
                </ItemManager>
              </v-toolbar>
              <v-list>
                <v-list-item>
                  <v-list-item-subtitle>作業内容</v-list-item-subtitle>
                  <v-list-item-title>
                    {{ model.workDescription }}
                  </v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>備考</v-list-item-subtitle>
                  <v-list-item-title>
                    {{ model.remarks }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" lg="9">
        <OperationResultsEmployeesManager :model="model" />
      </v-col>
      <v-col cols="12">
        <v-card>
          <v-toolbar density="comfortable">
            <v-toolbar-title>売上</v-toolbar-title>
          </v-toolbar>
          <v-data-table
            :headers="[
              { title: '項目' },
              { title: '数量' },
              { title: '単価' },
              { title: '金額' },
            ]"
            hide-default-footer
            items-per-page="-1"
          />
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-alert v-if="!!model.siteOperationScheduleId"
          >稼働予定から作成された稼働実績のため削除することはできません。</v-alert
        >
      </v-col>
    </v-row>
  </v-container>
</template>
