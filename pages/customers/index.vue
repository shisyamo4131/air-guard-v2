<script setup>
/**
 * @file pages/settings/customers.vue
 * @description 取引先管理画面
 */
import { Customer } from "@/schemas";
import { reactive } from "vue";

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
      :handle-create="(item) => item.create()"
      :handle-update="(item) => item.update()"
      :handle-delete="(item) => item.delete()"
    >
    </array-manager>
  </v-container>
</template>
