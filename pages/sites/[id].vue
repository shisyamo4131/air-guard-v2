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

const route = useRoute();
const siteId = route.params.id;
const model = reactive(new Site());
const scheduleInstance = reactive(new SiteOperationSchedule({ siteId }));

const currentDate = ref([new Date()]);

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

const period = computed(() => {
  const start = dayjs(currentDate.value[0]).startOf("month").toDate();
  const end = dayjs(currentDate.value[0]).endOf("month").toDate();
  return { start, end };
});
watch(
  period,
  async (newVal) => {
    const docId = route.params.id;
    if (docId && newVal && newVal.start && newVal.end) {
      scheduleInstance.subscribeDocs({
        constraints: [
          ["where", "siteId", "==", docId],
          ["where", "startAt", ">=", newVal.start],
          ["where", "startAt", "<=", newVal.end],
        ],
      });
    }
  },
  { immediate: true, deep: true }
);

onMounted(async () => {
  await model.subscribe({ docId: siteId });
});

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
            <ItemManager
              :model="model"
              :input-props="{
                excludedKeys: ['agreements'],
              }"
            >
            </ItemManager>
          </v-toolbar>
          <v-list :items="items"> </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <ArrayManager
          v-slot="slotProps"
          :model-value="scheduleInstance.docs"
          :schema="SiteOperationSchedule"
          :handle-create="
            async (item) => {
              item.siteId = siteId;
              await item.create();
            }
          "
          :handle-update="async (item) => await item.update()"
          :handle-delete="async (item) => await item.delete()"
        >
          <v-dialog v-bind="slotProps.dialogProps">
            <MoleculesEditCard v-bind="slotProps.editorProps">
              <air-item-input v-bind="slotProps.inputProps" />
            </MoleculesEditCard>
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
                :events="slotProps.items.map((schedule) => schedule.toEvent())"
                hide-week-number
                @click:event="slotProps.toUpdate($event.item)"
              />
            </v-container>
          </v-card>
        </ArrayManager>
      </v-col>
      <v-col>
        <v-card>
          <array-manager
            v-model="model.agreements"
            :schema="Agreement"
            :table-props="{
              hideDefaultFooter: true,
              itemsPerPage: -1,
              sortBy: [{ key: 'from', order: 'desc' }],
            }"
            @submit:complete="model.update()"
          >
          </array-manager>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
