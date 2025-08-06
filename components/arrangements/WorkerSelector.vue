<script setup>
import draggable from "vuedraggable";

/** define props */
const props = defineProps({
  items: { type: Array, default: () => [] },
});

/** define refs */
const activeTab = ref(0);
const tabs = ref([
  { label: "従業員", key: "employees" },
  { label: "外注先", key: "outsourcers" },
]);

const workers = computed(() => {
  const employees = props.items.filter((item) => item.isEmployee);
  const outsourcers = props.items.filter((item) => !item.isEmployee);
  return { employees, outsourcers };
});

/** define constants */
const DRAGGABLE_CONFIG = {
  tag: "div",
  class: "fill-height overflow-y-auto",
  itemKey: "workerId",
  group: { name: "workers", pull: "clone", put: false },
  sort: false,
};
</script>

<template>
  <div class="fill-height d-flex flex-column">
    <!-- タブナビゲーション -->
    <v-tabs v-model="activeTab" class="flex-shrink-0" grow>
      <v-tab v-for="(tab, index) in tabs" :key="index" :value="index">
        {{ tab.label }}
      </v-tab>
    </v-tabs>
    <v-window v-model="activeTab" class="fill-height">
      <v-window-item
        v-for="(tab, index) in tabs"
        :key="tab.key"
        :value="index"
        class="fill-height"
      >
        <div class="pa-2 fill-height">
          <draggable :model-value="workers[tab.key]" v-bind="DRAGGABLE_CONFIG">
            <template #item="{ element }">
              <slot name="default" :worker="element" />
            </template>
          </draggable>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>
