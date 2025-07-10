<script setup>
/**
 * @file pages/settings/operation-results.vue
 * @description 稼働実績管理画面
 */
import { OperationResult } from "@/schemas";
import { reactive, onMounted, onUnmounted } from "vue";
import { useFetchSite } from "@/composables/useFetchSite";
import dayjs from "dayjs";

const { fetchSite, cachedSites } = useFetchSite();

const operationResult = reactive(new OperationResult());
const docs = computed(() => operationResult.docs);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/** Call `fetchSite` when `docs` changes */
watch(docs, (newVal) => fetchSite(newVal), { deep: true });

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  operationResult.subscribeDocs();
});

onUnmounted(() => {
  operationResult.unsubscribe();
});
</script>

<template>
  <v-container>
    <array-manager
      v-model="docs"
      :schema="OperationResult"
      :input-props="{
        excludedKeys: ['employees', 'outsourcers'],
      }"
      :before-edit="
        (editMode, item) => {
          if (editMode === 'CREATE') return true;
          $router.push(`operation-results/${item.docId}`);
          return false;
        }
      "
      :handle-create="(item) => item.create()"
      @create="($event) => $router.push(`operation-results/${$event.docId}`)"
    >
      <template #default="slotProps">
        <air-data-table v-bind="slotProps.tableProps">
          <template #item.date="{ item }">
            <div>{{ dayjs(item.date).format("MM月DD日(ddd)") }}</div>
          </template>
          <template #item.siteId="{ item }">
            <div v-if="cachedSites[item.siteId]">
              {{ cachedSites[item.siteId].name || "ERROR" }}
            </div>
            <v-progress-circular v-else indeterminate size="small" />
          </template>
        </air-data-table>
        <v-dialog v-bind="slotProps.dialogProps">
          <MoleculesEditCard v-bind="slotProps.editorProps">
            <air-item-input v-bind="slotProps.inputProps" />
          </MoleculesEditCard>
        </v-dialog>
      </template>
    </array-manager>
  </v-container>
</template>
