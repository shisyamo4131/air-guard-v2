<script setup>
import draggable from "vuedraggable";

/** define props */
const props = defineProps({
  employees: { type: Array, default: () => [] },
  outsourcers: { type: Array, default: () => [] },
  getWorkerName: { type: Function, required: true },
});

/** define refs */
const activeTab = ref(0);
const tabs = ref([
  {
    label: "従業員",
    key: "employees",
    windowItem: { value: 0, modelValue: props.employees },
  },
  {
    label: "外注先",
    key: "outsourcers",
    windowItem: { value: 1, modelValue: props.outsourcers },
  },
]);

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
        v-for="tab in tabs"
        :key="tab.key"
        :value="tab.windowItem.value"
        class="fill-height"
      >
        <div class="pa-2 fill-height">
          <draggable
            :model-value="tab.windowItem.modelValue"
            v-bind="DRAGGABLE_CONFIG"
          >
            <template #item="{ element }">
              <MoleculesTagBase
                v-bind="element"
                :label="props.getWorkerName(element)"
              />
            </template>
          </draggable>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>
