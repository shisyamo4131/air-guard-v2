<script setup>
/**
 * @file ./pages/sites/[id].vue
 * @description 現場情報詳細ページ
 * - ルートパラメータ [id] は Sites コレクションのドキュメント id
 * - ドキュメント id をもとに Site クラスからドキュメント情報を取得して表示
 */
import dayjs from "dayjs";
import { reactive, onMounted, computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Site, Agreement, SiteOperationSchedule } from "~/schemas";
import { DAY_TYPE } from "air-guard-v2-schemas/constants";

const route = useRoute();
const siteId = route.params.id;
const model = reactive(new Site());
const scheduleInstance = reactive(new SiteOperationSchedule({ siteId }));
const schedules = ref([]);

const currentDate = ref([new Date()]);
const period = computed(() => {
  const start = dayjs(currentDate.value[0]).startOf("month").toDate();
  const end = dayjs(currentDate.value[0]).endOf("month").toDate();
  return { start, end };
});

const items = computed(() => {
  return [
    {
      title: "CODE",
      props: { subtitle: model.code, prependIcon: "mdi-magnify" },
    },
    {
      title: "住所",
      props: { subtitle: model.fullAddress, prependIcon: "mdi-map-marker" },
    },
    {
      title: "取引先",
      props: {
        subtitle: model.customer?.name || "loading",
        prependIcon: "mdi-domain",
      },
    },
  ];
});

onMounted(async () => {
  await model.subscribe({ docId: siteId });
});

watch(
  period,
  async (newVal) => {
    const docId = route.params.id;
    if (docId && newVal && newVal.start && newVal.end) {
      schedules.value = await scheduleInstance.subscribeDocs({
        constraints: [
          ["where", "siteId", "==", docId],
          ["where", "startDate", ">=", newVal.start],
          ["where", "startDate", "<=", newVal.end],
        ],
      });
    }
  },
  { immediate: true, deep: true }
);

onUnmounted(() => {
  model.unsubscribe();
  scheduleInstance.unsubscribe();
});
</script>
<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-toolbar density="comfortable">
            <v-toolbar-title>{{ model.name }}</v-toolbar-title>
            <v-spacer />
            <ItemManager :model="model" v-slot="slotProps">
              <v-dialog v-bind="slotProps.dialogProps">
                <template #activator>
                  <v-btn icon="mdi-pencil" @click="slotProps.toUpdate()" />
                </template>
                <MoleculesCardsEditor v-bind="slotProps.editorProps">
                  <air-item-input
                    v-bind="slotProps.inputProps"
                    :excluded-keys="['agreements']"
                  />
                </MoleculesCardsEditor>
              </v-dialog>
            </ItemManager>
          </v-toolbar>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <ItemManager
          :model="scheduleInstance"
          v-slot="slotProps"
          label="稼働予定"
        >
          <v-dialog v-bind="slotProps.dialogProps">
            <MoleculesCardsEditor v-bind="slotProps.editorProps">
              <air-item-input
                v-bind="slotProps"
                :schema="SiteOperationSchedule.schema"
              >
              </air-item-input>
            </MoleculesCardsEditor>
          </v-dialog>
          <v-card>
            <v-toolbar density="comfortable">
              <v-toolbar-title>稼働予定</v-toolbar-title>
              <v-spacer />
              <v-btn icon="mdi-plus" @click="slotProps.toCreate()" />
            </v-toolbar>
            <v-container class="pt-0">
              <air-calendar
                v-model="currentDate"
                :events="schedules.map((schedule) => schedule.toEvent())"
                hide-week-number
                @click:event="slotProps.toUpdate($event.item)"
              />
            </v-container>
          </v-card>
        </ItemManager>
      </v-col>
      <v-col>
        <air-array-manager
          v-model="model.agreements"
          :schema="Agreement"
          v-slot="slotProps"
          @submit:complete="model.update()"
        >
          <v-card>
            <air-data-table
              v-bind="slotProps.tableProps"
              items-per-page="-1"
              hide-default-footer
            />
            <v-dialog v-bind="slotProps.dialogProps">
              <MoleculesCardsEditor v-bind="slotProps.editorProps">
                <air-item-input v-bind="slotProps.inputProps" />
              </MoleculesCardsEditor>
            </v-dialog>
          </v-card>
        </air-array-manager>
      </v-col>
    </v-row>
  </v-container>
</template>
