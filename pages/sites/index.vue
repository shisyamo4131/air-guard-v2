<script setup>
/**
 * @file pages/settings/sites.vue
 * @description 現場管理画面
 */
import { Site } from "@/schemas";
import { reactive } from "vue";
import { useLogger } from "~/composables/useLogger";

// --- ストア / コンポーザブル
const logger = useLogger();

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
    <array-manager
      v-model="docs"
      :schema="Site"
      v-slot="slotProps"
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
      <air-data-table v-bind="slotProps.tableProps" />
      <v-dialog v-bind="slotProps.dialogProps">
        <air-edit-card v-bind="slotProps.editorProps" :logger="logger">
          <air-item-input v-bind="slotProps.inputProps" />
        </air-edit-card>
      </v-dialog>
    </array-manager>
  </v-container>
</template>
