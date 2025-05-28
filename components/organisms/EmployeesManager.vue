<script setup>
/**
 * @file EmployeesManager.vue
 * @description 従業員管理コンポーネント
 */
import { Employee } from "@/schemas/Employee.js";
import { reactive, onMounted, onUnmounted } from "vue";

const employee = reactive(new Employee());
const docs = computed(() => employee.docs);

const headers = [
  { title: "code", value: "code" },
  { title: "操作", value: "actions", align: "end", sortable: false },
];

onMounted(() => {
  employee.subscribeDocs();
});

onUnmounted(() => {
  employee.unsubscribe();
});
</script>

<template>
  <ItemManager :schema="employee" v-slot="slotProps" label="従業員情報">
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="Employee.schema" />
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table :items="docs" :headers="headers">
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>従業員一覧</v-toolbar-title>
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
