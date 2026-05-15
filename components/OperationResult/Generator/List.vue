<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Generator/List.vue
 * @description `OperationResultGenerator` 専用 `SiteOperationSchedule` リスト
 * - `items` はスロットプロパティであるため inject 不可能。
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  items: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "OperationResultGeneratorList");

/*****************************************************************************
 * INJECT
 *****************************************************************************/
const selectedSchedule = inject("selectedSchedule", null); // From index.vue

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const selectedItems = computed({
  get() {
    return selectedSchedule.value ? [selectedSchedule.value] : [];
  },
  set(v) {
    selectedSchedule.value = v.length > 0 ? v[0] : null;
  },
});
</script>

<template>
  <v-card class="d-flex flex-column" style="min-width: 288px; max-width: 288px">
    <v-toolbar
      class="flex-grow-0"
      color="secondary"
      density="compact"
      title="未確定現場稼働"
    />
    <!-- scroll container -->
    <div class="flex-grow-1 overflow-y-auto my-2">
      <air-list
        v-if="props.items.length > 0"
        v-model:selected="selectedItems"
        class="py-0"
      >
        <template v-for="(schedule, index) in props.items" :key="index">
          <SiteOperationScheduleListItem
            :schedule="schedule"
            :value="schedule"
          />
          <v-divider />
        </template>
      </air-list>
      <v-empty-state
        v-else
        title="未確定現場稼働はありません"
        icon="mdi-alert-circle-outline"
      />
    </div>
  </v-card>
</template>
