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

const route = useRoute();
const operationResultId = route.params.id;
const model = reactive(new OperationResult());

const items = computed(() => {
  return [
    {
      title: "日付",
      props: {
        subtitle: dayjs(model.date).format("YYYY-MM-DD"),
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
                <MoleculesCardsEditor v-bind="slotProps.editorProps">
                  <air-item-input
                    v-bind="slotProps"
                    :schema="OperationResult.schema"
                    :excluded-keys="['workers']"
                  />
                </MoleculesCardsEditor>
              </v-dialog>
            </ItemManager>
          </v-toolbar>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-card>
          <v-toolbar density="comfortable">
            <v-toolbar-title>稼働実績明細</v-toolbar-title>
            <v-spacer />
            <ItemManager :model="model" v-slot="slotProps" label="稼働実績明細">
              <v-dialog v-bind="slotProps.dialogProps">
                <template #activator>
                  <v-btn icon="mdi-pencil" @click="slotProps.toUpdate()" />
                </template>
                <MoleculesCardsEditor
                  v-bind="slotProps.editorProps"
                  hide-delete-btn
                >
                  <air-item-input
                    v-bind="slotProps"
                    :schema="OperationResult.schema"
                    :included-keys="['workers']"
                  />
                </MoleculesCardsEditor>
              </v-dialog>
            </ItemManager>
          </v-toolbar>
          <v-data-table
            :headers="[
              { title: '氏名' },
              { title: '開始時刻' },
              { title: '終了時刻' },
              { title: '休憩時間' },
              { title: '残業時間' },
              { title: '資格者' },
              { title: 'OJT' },
            ]"
            hide-default-footer
            items-per-page="-1"
          />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
