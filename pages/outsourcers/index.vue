<script setup>
/**
 * @file pages/settings/outsourcers.vue
 * @description 外注先管理画面
 */
import { Outsourcer } from "@/schemas";
import { reactive } from "vue";

const model = reactive(new Outsourcer());
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
      :schema="Outsourcer"
      :handle-create="(item) => item.create()"
      :handle-update="(item) => item.update()"
      :handle-delete="(item) => item.delete()"
    >
    </air-array-manager>
  </v-container>
</template>
