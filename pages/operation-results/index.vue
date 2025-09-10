<script setup>
/**
 * @file pages/settings/operation-results.vue
 * @description 稼働実績管理画面
 */
import dayjs from "dayjs";
import { OperationResult } from "@/schemas";
import { reactive, onMounted, onUnmounted } from "vue";
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import { getDayType } from "air-guard-v2-schemas/constants";

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
    <air-array-manager
      v-model="operationResult.docs"
      :schema="OperationResult"
      :input-props="{
        excludedKeys: ['status', 'employees', 'outsourcers'],
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
      <template #input="inputProps">
        <air-item-input v-bind="inputProps">
          <template #dateAt="{ attrs }">
            <air-date-input
              v-bind="attrs"
              @update:modelValue="
                inputProps.updateProperties({ dayType: getDayType($event) })
              "
            />
          </template>
        </air-item-input>
      </template>
      <template #table="tableProps">
        <air-data-table v-bind="tableProps">
          <template #item.dateAt="{ item }">
            <div>{{ dayjs(item.dateAt).format("MM月DD日(ddd)") }}</div>
          </template>
          <template #item.siteId="{ item }">
            <div v-if="cachedSites[item.siteId]">
              {{ cachedSites[item.siteId].name || "ERROR" }}
            </div>
            <v-progress-circular v-else indeterminate size="small" />
          </template>
        </air-data-table>
      </template>
    </air-array-manager>
  </v-container>
</template>
