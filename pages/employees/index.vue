<script setup>
import { Employee } from "air-guard-v2-schemas";
import { reactive, onMounted, onUnmounted } from "vue";

const employee = reactive(new Employee());
const docs = computed(() => employee.docs);
const isEditing = ref(false);
const isValid = ref(null);
const manager = ref(null);

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

function edit(item) {
  employee.initialize(item);
  manager.value.toUpdate();
}
</script>

<template>
  <v-container>
    <air-item-manager
      ref="manager"
      v-model="employee"
      v-model:isEditing="isEditing"
      v-slot="slotProps"
    >
      <v-dialog v-bind="slotProps.dialogProps" max-width="480">
        <MoleculesCardsEditor
          label="従業員情報編集"
          :disable-submit="!isValid"
          @click:close="slotProps.quitEditing"
          @click:submit="slotProps.submit"
        >
          <MoleculesFormsEmployee
            v-model="isValid"
            :item="slotProps.item"
            :update-properties="slotProps.updateProperties"
          />
        </MoleculesCardsEditor>
      </v-dialog>
      <v-data-table :items="docs" :headers="headers">
        <template v-slot:item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-icon
              color="medium-emphasis"
              icon="mdi-pencil"
              size="small"
              @click="edit(item)"
            ></v-icon>

            <v-icon
              color="medium-emphasis"
              icon="mdi-delete"
              size="small"
            ></v-icon>
          </div>
        </template>
      </v-data-table>
    </air-item-manager>
  </v-container>
</template>
