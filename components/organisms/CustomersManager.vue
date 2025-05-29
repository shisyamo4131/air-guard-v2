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
  { title: "取引先名", value: "customerName" },
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
  <ItemManager :schema="customer" v-slot="slotProps" label="取引先情報">
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="Customer.schema">
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
          <v-toolbar-title>取引先一覧</v-toolbar-title>
          <v-btn icon="mdi-plus" @click="slotProps.toCreate()"></v-btn>
        </v-toolbar>
      </template>
      <template v-slot:item.actions="{ item }">
        <div class="d-flex ga-2 justify-end">
          <v-icon
            color="medium-emphasis"
            size="small"
            @click="slotProps.toUpdate(item)"
          >
            mdi-pencil
          </v-icon>
          <v-icon
            color="medium-emphasis"
            size="small"
            @click="slotProps.toDelete(item)"
          >
            mdi-trash-can
          </v-icon>
        </div>
      </template>
    </v-data-table>
  </ItemManager>
</template>
