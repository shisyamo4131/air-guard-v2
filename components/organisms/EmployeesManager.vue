<script setup>
/**
 * @file EmployeesManager.vue
 * @description 従業員管理コンポーネント
 */
import { Employee } from "@/schemas";
import { reactive, onMounted, onUnmounted } from "vue";

const employee = reactive(new Employee());
const docs = computed(() => employee.docs);

const headers = [
  { title: "code", key: "code" },
  { title: "名前", key: "displayName" },
  { title: "状態", key: "employmentStatus" },
  { title: "操作", key: "actions", align: "end", sortable: false },
];

onMounted(() => {
  employee.subscribeDocs();
});

onUnmounted(() => {
  employee.unsubscribe();
});
</script>

<template>
  <ItemManager
    :model="employee"
    v-slot="slotProps"
    label="従業員情報"
    :dialog-props="{ maxWidth: 640 }"
  >
    <v-dialog v-bind="slotProps.dialogProps">
      <MoleculesCardsEditor v-bind="slotProps.editorProps">
        <air-item-input v-bind="slotProps" :schema="Employee.schema" />
      </MoleculesCardsEditor>
    </v-dialog>
    <v-data-table
      :items="docs"
      :headers="headers"
      :sort-by="[{ key: 'code', order: 'asc' }]"
    >
      <template #top>
        <v-toolbar density="compact" flat>
          <v-toolbar-title>従業員一覧</v-toolbar-title>
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
