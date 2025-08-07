<script setup>
/**
 * @file components/molecules/WorkerSelector.vue
 *
 * @description A component for selecting workers (employees and outsourcers) with drag-and-drop functionality.
 * This component receives lists of employees and outsourcers, converts them to a specific format by a provided
 * converter function and displays them in a tabbed interface.
 * Use `employee` and `outsourcer` slots to display each worker's information.
 *
 * @props {Function} converter - Function to convert worker items to a specific format.
 * @props {String} convertedItemKey - Key used to access the worker ID in the converted items.
 * @props {Array} employees - List of employee objects (instances).
 * @props {Array} outsourcers - List of outsourcer objects (instances).
 *
 * @slots
 * @slot employee - Slot for rendering employee items. Receives `element` and `rawElement` as props.
 * @slot outsourcer - Slot for rendering outsourcer items. Receives `element` and `rawElement` as props.
 * note: `rawElement` is the original object from the `employees` or `outsourcers` arrays.
 *
 * @emits tab-changed - Emitted when the active tab changes.
 */
import { ref, watch } from "vue";
import draggable from "vuedraggable";
import { useLogger } from "@/composables/useLogger";
import { OperationResultDetail } from "@/schemas";

/** define constants */
const TABS_CONFIG = [
  { label: "従業員", key: "employees" },
  { label: "外注先", key: "outsourcers" },
];

/** define props */
const props = defineProps({
  converter: {
    type: Function,
    default: (item, isEmployee) =>
      new OperationResultDetail({ workerId: item.docId, isEmployee }),
  },
  convertedItemKey: { type: String, default: "workerId" },
  employees: { type: Array, default: () => [] },
  outsourcers: { type: Array, default: () => [] },
});

/** define emits */
const emit = defineEmits(["tab-changed"]);

/** define composables */
const logger = useLogger();

/** define refs */
const activeTab = ref(0);
const convertedEmployees = ref([]);
const convertedOutsourcers = ref([]);
const employeeMap = ref({}); // Map for quick access to employee objects by their docId
const outsourcerMap = ref({}); // Map for quick access to outsourcer objects by their docId

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * Updates `convertedEmployees` and `employeeMap` whenever `props.employees` changes.
 */
watch(() => props.employees, updateConvertedEmployees, {
  immediate: true,
  deep: true,
});

/**
 * Updates `convertedOutsourcers` and `outsourcerMap` whenever `props.outsourcers` changes.
 */
watch(() => props.outsourcers, updateConvertedOutsourcers, {
  immediate: true,
  deep: true,
});

/**
 * Emits an `tab-changed` event whenever the active tab changes.
 */
watch(activeTab, (newTab) => emit("tab-changed", newTab));

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Updates the converted items and their maps based on the provided items and whether they are employees.
 * @param items
 * @param isEmployee
 */
function convertAndMap(items, isEmployee) {
  logger.clearError();
  try {
    const converted = items.map((item) => props.converter(item, isEmployee));
    const map = Object.fromEntries(items.map((item) => [item.docId, item]));
    return { converted, map };
  } catch (error) {
    logger.error({
      sender: "WorkerSelector",
      message: "Conversion failed",
      error,
    });
    return { converted: [], map: {} };
  }
}

/**
 * Updates the converted employees and their map.
 */
function updateConvertedEmployees() {
  const { converted, map } = convertAndMap(props.employees, true);
  convertedEmployees.value = converted;
  employeeMap.value = map;
}

/**
 * Updates the converted outsourcers and their map.
 */
function updateConvertedOutsourcers() {
  const { converted, map } = convertAndMap(props.outsourcers, false);
  convertedOutsourcers.value = converted;
  outsourcerMap.value = map;
}
</script>

<template>
  <div class="fill-height d-flex flex-column">
    <!-- タブナビゲーション -->
    <v-tabs v-model="activeTab" class="flex-shrink-0" grow>
      <v-tab v-for="(tab, index) in TABS_CONFIG" :key="index" :value="index">
        {{ tab.label }}
      </v-tab>
    </v-tabs>

    <!-- タブコンテンツ -->
    <v-window v-model="activeTab" class="fill-height">
      <!-- 従業員 -->
      <v-window-item :value="0" class="fill-height">
        <div class="pa-2 fill-height">
          <draggable
            class="fill-height overflow-y-auto"
            :model-value="convertedEmployees"
            :item-key="convertedItemKey"
            :group="{ name: 'workers', pull: 'clone', put: false }"
            :sort="false"
          >
            <template #item="{ element }">
              <div>
                <slot
                  name="employee"
                  :element="element"
                  :rawElement="employeeMap[element[convertedItemKey]] || null"
                />
              </div>
            </template>
          </draggable>
        </div>
      </v-window-item>

      <!-- 外注先 -->
      <v-window-item :value="1" class="fill-height">
        <div class="pa-2 fill-height">
          <draggable
            class="fill-height overflow-y-auto"
            :model-value="convertedOutsourcers"
            :item-key="convertedItemKey"
            :group="{ name: 'workers', pull: 'clone', put: false }"
            :sort="false"
          >
            <template #item="{ element }">
              <div>
                <slot
                  name="outsourcer"
                  :element="element"
                  :rawElement="outsourcerMap[element[convertedItemKey]] || null"
                />
              </div>
            </template>
          </draggable>
        </div>
      </v-window-item>
    </v-window>
  </div>
</template>
