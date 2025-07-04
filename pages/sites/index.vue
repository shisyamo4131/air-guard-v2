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
        <MoleculesCardsEditor v-bind="slotProps.editorProps">
          <air-item-input v-bind="slotProps.inputProps" />
        </MoleculesCardsEditor>
      </v-dialog>
    </array-manager>
  </v-container>
</template>
