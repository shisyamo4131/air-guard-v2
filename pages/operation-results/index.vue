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

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/** Call `fetchSite` when `docs` changes */
watch(operationResult.docs, (newVal) => fetchSite(newVal), { deep: true });

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
      v-model="operationResult.docs"
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
      <template #table="tableProps">
        <air-data-table v-bind="tableProps">
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
      </template>
    </array-manager>
  </v-container>
</template>
