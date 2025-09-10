<script setup>
/**
 * @file pages/settings/sites.vue
 * @description 現場管理画面
 */
import { Site } from "@/schemas";
import { reactive } from "vue";

const model = reactive(new Site());
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
      :schema="Site"
      :input-props="{
        excludedKeys: ['agreements'],
      }"
      :before-edit="
        (editMode, item) => {
          if (editMode === 'CREATE') return true;
          $router.push(`sites/${item.docId}`);
          return false;
        }
      "
      :handle-create="(item) => item.create()"
      @create="($event) => $router.push(`sites/${$event.docId}`)"
    >
    </air-array-manager>
  </v-container>
</template>
