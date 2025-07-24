<script setup>
import draggable from "vuedraggable";

/** define props */
const props = defineProps({
  isVisible: { type: Boolean, required: true },
  initialX: { type: Number, default: 200 },
  initialY: { type: Number, default: 100 },
  employees: { type: Array, default: () => [] },
  outsourcers: { type: Array, default: () => [] },
  cachedEmployees: { type: Object, default: () => ({}) },
  cachedOutsourcers: { type: Object, default: () => ({}) },
});

/** define emits */
const emit = defineEmits(["close", "move"]);

/** define refs */
const activeTab = ref(0);
const tabs = ref([
  { label: "従業員", key: "employees" },
  { label: "外注先", key: "outsourcers" },
]);
</script>

<template>
  <MoleculesFloatingWindow
    :is-visible="isVisible"
    title="作業員選択"
    :initial-x="initialX"
    :initial-y="initialY"
    @close="$emit('close')"
    @move="$emit('move', $event)"
  >
    <div class="fill-height d-flex flex-column">
      <!-- タブナビゲーション -->
      <v-tabs v-model="activeTab" class="flex-shrink-0" grow>
        <v-tab v-for="(tab, index) in tabs" :key="index" :value="index">
          {{ tab.label }}
        </v-tab>
      </v-tabs>

      <!-- タブコンテンツ -->
      <v-window v-model="activeTab" class="fill-height">
        <!-- 従業員タブ -->
        <v-window-item :value="0" class="fill-height">
          <div class="pa-2 fill-height">
            <draggable
              :model-value="employees"
              tag="div"
              class="fill-height overflow-y-auto"
              item-key="workerId"
              :group="{ name: 'workers', pull: 'clone', put: false }"
              :sort="false"
            >
              <template #item="{ element }">
                <ArrangementsTag
                  v-bind="element"
                  :cached-employees="cachedEmployees"
                />
              </template>
            </draggable>
          </div>
        </v-window-item>

        <!-- 外注先タブ -->
        <v-window-item :value="1" class="fill-height">
          <div class="pa-2 fill-height">
            <draggable
              :model-value="outsourcers"
              tag="div"
              class="fill-height overflow-y-auto"
              item-key="workerId"
              :group="{ name: 'workers', pull: 'clone', put: false }"
              :sort="false"
            >
              <template #item="{ element }">
                <ArrangementsTag
                  v-bind="element"
                  :cached-outsourcers="cachedOutsourcers"
                />
              </template>
            </draggable>
          </div>
        </v-window-item>
      </v-window>
    </div>
  </MoleculesFloatingWindow>
</template>
