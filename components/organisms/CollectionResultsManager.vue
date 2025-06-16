<script setup>
/**
 * @file CollectionResultsManager.vue
 * @description 回収実績管理コンポーネント
 */
import { CollectionResult } from "@/schemas/CollectionResult.js";
import { reactive, onMounted, onUnmounted } from "vue";

const collectionResult = reactive(new CollectionResult());
const docs = computed(() => collectionResult.docs);

const headers = [
  { title: "code", value: "code" },
  { title: "回収実績名", value: "name" },
  { title: "取引先名", value: "customer.name" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  collectionResult.subscribeDocs();
});

onUnmounted(() => {
  collectionResult.unsubscribe();
});
</script>

<template>
  <ItemManager
    :model="collectionResult"
    v-slot="slotProps"
    label="回収実績情報"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="CollectionResult.schema" />
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table :items="docs" :headers="headers">
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>回収実績一覧</v-toolbar-title>
          <v-btn icon="mdi-plus" @click="slotProps.toCreate()"></v-btn>
        </v-toolbar>
      </template>
      <template v-slot:item.actions="{ item }">
        <div class="d-flex ga-2 justify-end">
          <AtomsIconsEdit @click="slotProps.toUpdate(item)" />
          <AtomsIconsDelete @click="slotProps.toDelete(item)" />
        </div>
      </template>
    </v-data-table>
  </ItemManager>
</template>
