<script setup>
/**
 * @file CollectionItemsManager.vue
 * @description 回収品目管理コンポーネント
 */
import { CollectionItem } from "@/schemas/CollectionItem.js";
import { reactive, onMounted, onUnmounted } from "vue";

const collectionResult = reactive(new CollectionItem());
const docs = computed(() => collectionResult.docs);

const headers = [
  { title: "code", value: "code" },
  { title: "回収品目名", value: "name" },
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
    label="回収品目情報"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="CollectionItem.schema" />
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table :items="docs" :headers="headers">
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>回収品目一覧</v-toolbar-title>
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
