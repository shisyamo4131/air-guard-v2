<script setup>
/**
 * @file SitesManager.vue
 * @description 排出場所管理コンポーネント
 */
import { Site } from "@/schemas/Site.js";
import { reactive, onMounted, onUnmounted } from "vue";

const site = reactive(new Site());
const docs = computed(() => site.docs);

const headers = [
  { title: "code", value: "code" },
  { title: "排出場所名", value: "name" },
  { title: "取引先名", value: "customer.name" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  site.subscribeDocs();
});

onUnmounted(() => {
  site.unsubscribe();
});
</script>

<template>
  <ItemManager :model="site" v-slot="slotProps" label="排出場所情報">
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="Site.schema">
          <template #zipcode="{ attrs }">
            <air-postal-code
              v-bind="attrs"
              @update:address="
                slotProps.updateProperties({
                  prefCode: $event.prefcode,
                  city: $event.address2,
                  address: $event.address3,
                })
              "
            />
          </template>
        </air-item-input>
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table :items="docs" :headers="headers">
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>排出場所一覧</v-toolbar-title>
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
