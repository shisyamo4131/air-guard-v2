<script setup>
/**
 * @file pages/settings/employees.vue
 * @description 従業員管理画面
 */
import { Employee } from "@/schemas";
import { reactive } from "vue";

const model = reactive(new Employee());
const docs = ref([]);

onMounted(() => {
  docs.value = model.subscribeDocs();
});

onUnmounted(() => {
  model.unsubscribe();
});
</script>

<template>
  <v-container>
    <array-manager
      v-model="docs"
      :schema="Employee"
      v-slot="slotProps"
      :handle-create="(item) => item.create()"
      :handle-update="(item) => item.update()"
      :handle-delete="(item) => item.delete()"
    >
      <air-data-table v-bind="slotProps.tableProps" />
      <v-dialog v-bind="slotProps.dialogProps">
        <MoleculesCardsEditor v-bind="slotProps.editorProps">
          <air-item-input v-bind="slotProps.inputProps" />
        </MoleculesCardsEditor>
      </v-dialog>
    </array-manager>
  </v-container>
</template>
