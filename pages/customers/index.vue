<script setup>
/**
 * @file pages/settings/customers.vue
 * @description 取引先管理画面
 */
import { useLogger } from "~/composables/useLogger";
import { Customer } from "@/schemas";
import { reactive } from "vue";

// --- ストア / コンポーザブル
const logger = useLogger();

const model = reactive(new Customer());
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
      :schema="Customer"
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
