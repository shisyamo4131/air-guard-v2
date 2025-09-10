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
    <air-array-manager
      v-model="docs"
      :schema="Employee"
      :handle-create="(item) => item.create()"
      :handle-update="(item) => item.update()"
      :handle-delete="(item) => item.delete()"
    >
    </air-array-manager>
  </v-container>
</template>
