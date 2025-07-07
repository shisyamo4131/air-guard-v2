<script setup>
/**
 * @file pages/settings/operation-results.vue
 * @description 稼働実績管理画面
 */
import { OperationResult } from "@/schemas";
import { reactive, onMounted, onUnmounted } from "vue";
import { useFetchSite } from "@/composables/useFetchSite";
import dayjs from "dayjs";

const { fetchSite, cachedSites, isLoading: isSitesLoading } = useFetchSite();

const operationResult = reactive(new OperationResult());
const docs = computed(() => operationResult.docs);
watch(docs, (newVal) => fetchSite(newVal), { deep: true });

const headers = [
  {
    title: "日付",
    key: "date",
    value: (item) => dayjs(item.date).format("MM月DD日(ddd)"),
  },
  { title: "現場名", key: "siteId", value: "siteId" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  operationResult.subscribeDocs();
});

onUnmounted(() => {
  operationResult.unsubscribe();
});
</script>

<template>
  <v-container>
    <ItemManager
      :model="operationResult"
      v-slot="slotProps"
      label="稼働実績"
      :before-edit="
        (editMode, item) => {
          if (editMode === 'CREATE') return true;
          $router.push(`operation-results/${item.docId}`);
          return false;
        }
      "
    >
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesEditCard v-bind="slotProps.editorProps">
          <air-item-input
            v-bind="slotProps"
            :schema="OperationResult.schema"
            :excluded-keys="['workers']"
          />
        </MoleculesEditCard>
      </v-dialog>
      <v-data-table :items="docs" :headers="headers" :loading="isSitesLoading">
        <template #top>
          <v-toolbar density="compact" flat>
            <v-toolbar-title>稼働実績一覧</v-toolbar-title>
            <v-btn icon="mdi-plus" @click="slotProps.toCreate()"></v-btn>
          </v-toolbar>
        </template>
        <template v-slot:item.siteId="{ item }">
          {{ cachedSites[item.siteId]?.name || "" }}
        </template>
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <AtomsIconsEdit @click="slotProps.toUpdate(item)" />
            <AtomsIconsDelete @click="slotProps.toDelete(item)" />
          </div>
        </template>
      </v-data-table>
    </ItemManager>
  </v-container>
</template>
