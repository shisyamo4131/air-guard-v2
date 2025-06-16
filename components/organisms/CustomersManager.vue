<script setup>
/**
 * @file CustomersManager.vue
 * @description 取引先管理コンポーネント
 */
import { Customer } from "@/schemas/Customer.js";
import { reactive, onMounted, onUnmounted } from "vue";

const customer = reactive(new Customer());
const docs = computed(() => customer.docs);

const headers = [
  { title: "code", value: "code" },
  { title: "取引先名", value: "name" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  customer.subscribeDocs();
});

onUnmounted(() => {
  customer.unsubscribe();
});
</script>

<template>
  <ItemManager :model="customer" v-slot="slotProps" label="取引先情報">
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="Customer.schema" />
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table :items="docs" :headers="headers">
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>取引先一覧</v-toolbar-title>
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
