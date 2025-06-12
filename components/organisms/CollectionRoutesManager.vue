<script setup>
/**
 * @file CollectionRoutesManager.vue
 * @description ルート管理コンポーネント
 */
import { CollectionRoute } from "@/schemas/CollectionRoute.js";
import { reactive, onMounted, onUnmounted } from "vue";

const collectionRoute = reactive(new CollectionRoute());
const docs = computed(() => collectionRoute.docs);

const headers = [
  { title: "ルートコード", value: "code" },
  { title: "ルート名", value: "name" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  collectionRoute.subscribeDocs();
});

onUnmounted(() => {
  collectionRoute.unsubscribe();
});
</script>

<template>
  <ItemManager :model="collectionRoute" v-slot="slotProps" label="ルート情報">
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="CollectionRoute.schema">
        </air-item-input>
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table :items="docs" :headers="headers">
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>ルート一覧</v-toolbar-title>
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
