<script setup>
/**
 * @file ./pages/operation-results/[id].vue
 * @description 稼働実績詳細ページ
 * - ルートパラメータ [id] は OperationResults コレクションのドキュメント id
 * - ドキュメント id をもとに OperationResult クラスからドキュメント情報を取得して表示
 */
import dayjs from "dayjs";
import { reactive, onMounted, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { OperationResult } from "~/schemas";

/** Get operation-result-id from route parameters */
const route = useRoute();
const operationResultId = route.params.id;

const model = reactive(new OperationResult());

const items = computed(() => {
  return [
    {
      title: "日付",
      props: {
        subtitle: dayjs(model.dateAt).format("YYYY-MM-DD"),
        prependIcon: "mdi-calendar",
      },
    },
    {
      title: "曜日区分",
      props: {
        subtitle: model.dayType,
        prependIcon: "mdi-calendar",
      },
    },
    {
      title: "勤務区分",
      props: {
        subtitle: model.shiftType,
        prependIcon: "mdi-calendar",
      },
    },
    {
      title: "現場",
      props: { subtitle: model.siteId, prependIcon: "mdi-map-marker" },
    },
  ];
});

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
              <v-list>
                <v-list-item>
                  <v-list-item-subtitle>現場</v-list-item-subtitle>
                  <v-list-item-title>大手町</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>日付</v-list-item-subtitle>
                  <v-list-item-title>2025年7月8日（火）</v-list-item-title>
                </v-list-item>
                <v-list-item>
                  <v-list-item-subtitle>区分</v-list-item-subtitle>
                  <v-list-item-title>平日 日勤</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card>
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
      <v-col cols="12" lg="9">
        <OperationResultsEmployeesManager :model="model" />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-toolbar density="comfortable">
            <v-toolbar-title>稼働実績</v-toolbar-title>
            <v-spacer />
            <ItemManager :model="model" v-slot="slotProps" label="稼働実績">
              <v-dialog v-bind="slotProps.dialogProps">
                <template #activator>
                  <v-btn icon="mdi-pencil" @click="slotProps.toUpdate()" />
                </template>
                <MoleculesEditCard v-bind="slotProps.editorProps">
                  <air-item-input
                    v-bind="slotProps"
                    :schema="OperationResult.schema"
                    :excluded-keys="['employees', 'outsourcers']"
                  />
                </MoleculesEditCard>
              </v-dialog>
            </ItemManager>
          </v-toolbar>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
