<script setup>
import { Employee } from "air-guard-v2-schemas";
import { reactive, onMounted, onUnmounted } from "vue";

const employee = reactive(new Employee());
const docs = computed(() => employee.docs);

const headers = [
  { title: "姓", value: "lastName" },
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
  <v-container>
    <ItemManager v-model="employee" v-slot="slotProps" label="従業員情報">
      <v-dialog v-bind="slotProps.dialogProps" max-width="480">
        <MoleculesCardsEditor v-bind="slotProps.editorProps">
          <air-item-input v-bind="slotProps" :schema="Employee.schema">
          </air-item-input>
        </MoleculesCardsEditor>
      </v-dialog>
      <v-data-table :items="docs" :headers="headers">
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-icon
              color="medium-emphasis"
              icon="mdi-pencil"
              size="small"
              @click="slotProps.toUpdate(item)"
            ></v-icon>

            <v-icon
              color="medium-emphasis"
              icon="mdi-delete"
              size="small"
              @click="slotProps.toDelete(item)"
            ></v-icon>
          </div>
        </template>
      </v-data-table>
    </ItemManager>
  </v-container>
</template>
