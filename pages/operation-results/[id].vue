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
            :is-editing="slotProps.isEditing"
            :model-value="
              slotProps.isEditing ? slotProps.item.employees : model.employees
            "
            @add="slotProps.item.addEmployee($event)"
            @click:cancel="slotProps.quitEditing()"
            @click:edit="slotProps.toUpdate()"
            @click:submit="slotProps.submit()"
            @remove="slotProps.item.removeEmployee($event)"
            @update:modelValue="
              slotProps.updateProperties({ employees: $event })
            "
          />
        </ItemManager>
      </v-col>
    </v-row>
  </v-container>
</template>
