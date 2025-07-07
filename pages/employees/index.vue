<script setup>
/**
 * @file pages/settings/employees.vue
 * @description 従業員管理画面
 */
import { useLogger } from "~/composables/useLogger";
import { Employee } from "@/schemas";
import { reactive } from "vue";

// --- ストア / コンポーザブル
const logger = useLogger();

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
        <air-edit-card v-bind="slotProps.editorProps" :logger="logger">
          <air-item-input v-bind="slotProps.inputProps" />
        </air-edit-card>
      </v-dialog>
    </array-manager>
  </v-container>
</template>
