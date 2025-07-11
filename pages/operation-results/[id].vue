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
import { useAuthStore } from "@/stores/useAuthStore";
import { OperationResult } from "~/schemas";

/** Get operation-result-id from route parameters */
const route = useRoute();
const operationResultId = route.params.id;

/** define stores */
const auth = useAuthStore();

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

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const defaultDateTimeAt = computed(() => {
  if (!model.docId) return { startAt: null, endAt: null };

  const shiftType = model.shiftType;
  const timeMap = auth.company.defaultTimeMap;

  const { start, end } = timeMap[shiftType] || { start: "00:00", end: "00:00" };

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const startAt = dayjs(model.date).hour(startH).minute(startM).second(0);
  const endAt = dayjs(model.date).hour(endH).minute(endM).second(0);

  return { startAt, endAt };
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
      <v-col cols="12">
        <ItemManager :model="model" v-slot="slotProps">
          <OperationResultsEmployeesManager
            :default-attendance="defaultDateTimeAt"
            :model-value="model.employees"
            @update:modelValue="
              slotProps.toUpdate();
              $nextTick(() => {
                slotProps.updateProperties({ employees: $event });
                slotProps.submit();
              });
            "
          />
        </ItemManager>
      </v-col>
    </v-row>
  </v-container>
</template>
