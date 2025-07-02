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
import { OperationResult, OperationResultEmployee } from "~/schemas";
import { useFetchEmployee } from "@/composables/useFetchEmployee";
import OperationResultStartTimeEditor from "@/components/operation-results/StartTimeEditor.vue";
import OperationResultEndTimeEditor from "@/components/operation-results/EndTimeEditor.vue";

const route = useRoute();
const operationResultId = route.params.id;

const { fetchEmployee, cachedEmployees } = useFetchEmployee();

const model = reactive(new OperationResult());
watch(model, (newVal) => fetchEmployee(newVal.employees), { deep: true });

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

const editors = {
  startAt: OperationResultStartTimeEditor,
  endAt: OperationResultEndTimeEditor,
};
const editTarget = ref(null);
const editComponent = computed(() => {
  return editors[editTarget.value];
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
                    :excluded-keys="['employees', 'outsourcers']"
                  />
                </MoleculesCardsEditor>
              </v-dialog>
            </ItemManager>
          </v-toolbar>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <ItemManager :model="model" v-slot="slotProps" label="稼働実績">
          <air-array-manager
            :model-value="
              slotProps.isEditing ? slotProps.item.employees : model.employees
            "
            :schema="OperationResultEmployee"
            v-slot="arrayManagerProps"
            @update:modelValue="
              slotProps.updateProperties({ employees: $event })
            "
          >
            <v-card>
              <v-toolbar density="comfortable">
                <v-toolbar-title>稼働実績明細</v-toolbar-title>
                <v-spacer />
                <v-btn
                  v-if="!slotProps.isEditing"
                  icon="mdi-pencil"
                  @click="slotProps.toUpdate()"
                />
                <div v-else>
                  <v-btn icon="mdi-close" @click="slotProps.quitEditing" />
                  <v-btn icon="mdi-check" @click="slotProps.submit" />
                </div>
              </v-toolbar>
              <OperationResultsDataTable
                :items="arrayManagerProps.items"
                :employees="cachedEmployees"
                :is-edit="slotProps.isEditing"
                @click:startAt="
                  editTarget = 'startAt';
                  arrayManagerProps.toUpdate($event);
                "
                @click:endAt="
                  editTarget = 'endAt';
                  arrayManagerProps.toUpdate($event);
                "
                @click:isQualificated="
                  editTarget = null;
                  arrayManagerProps.toUpdate($event.item);
                  $nextTick(() => {
                    arrayManagerProps.updateProperties({
                      isQualificated: $event.value,
                    });
                    arrayManagerProps.submit();
                  });
                "
                @click:isOjt="
                  editTarget = null;
                  arrayManagerProps.toUpdate($event.item);
                  $nextTick(() => {
                    arrayManagerProps.updateProperties({
                      isOjt: $event.value,
                    });
                    arrayManagerProps.submit();
                  });
                "
              />
              <v-dialog
                :model-value="arrayManagerProps.isEditing && !!editTarget"
                @update:modelValue="arrayManagerProps.quitEditing"
                width="auto"
                :fullscreen="$vuetify.display.mobile"
              >
                <component
                  :is="editComponent"
                  :item="arrayManagerProps.item"
                  :submit="arrayManagerProps.submit"
                  :update-properties="arrayManagerProps.updateProperties"
                  @click:close="arrayManagerProps.quitEditing"
                />
              </v-dialog>
            </v-card>
          </air-array-manager>
        </ItemManager>
      </v-col>
    </v-row>
  </v-container>
</template>
