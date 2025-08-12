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
import { useKatakanaFilter } from "../../composables/useKatakanaFilter";
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
const { selectedCharNumber, selectableChars, filterByKatakana } =
  useKatakanaFilter();

/** define refs */
const activeTab = ref(0);
const employeesMap = ref({});
const outsourcersMap = ref({});
const convertedEmployeesMap = ref({});
const convertedOutsourcersMap = ref({});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.employees,
  (newEmployees) => {
    newEmployees.forEach((emp) => {
      convertedEmployeesMap.value[emp.docId] = props.converter(emp, true);
      employeesMap.value[emp.docId] = emp;
    });
  },
  { immediate: true }
);

watch(
  () => props.outsourcers,
  (newOutsourcers) => {
    newOutsourcers.forEach((out) => {
      convertedOutsourcersMap.value[out.docId] = props.converter(out, false);
      outsourcersMap.value[out.docId] = out;
    });
  },
  { immediate: true }
);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const filteredEmployees = computed(() => {
  const filtered = filterByKatakana(props.employees, "lastNameKana").sort(
    (a, b) => a.lastNameKana.localeCompare(b.lastNameKana)
  );
  let result = [];
  filtered.forEach((emp) => {
    result.push(convertedEmployeesMap.value[emp.docId]);
  });
  return result;
});

const filteredOutsourcers = computed(() => {
  const filtered = filterByKatakana(props.outsourcers, "nameKana").sort(
    (a, b) => a.nameKana.localeCompare(b.nameKana)
  );
  let result = [];
  filtered.forEach((out) => {
    result.push(convertedOutsourcersMap.value[out.docId]);
  });
  return result;
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
</script>

<template>
  <div class="fill-height d-flex">
    <div class="fill-height d-flex flex-column flex-grow-1">
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
          <draggable
            class="fill-height overflow-y-auto pa-2"
            :model-value="filteredEmployees"
            :item-key="convertedItemKey"
            :group="{ name: 'workers', pull: 'clone', put: false }"
            :sort="false"
          >
            <template #item="{ element }">
              <div>
                <slot
                  name="employee"
                  :element="element"
                  :rawElement="employeesMap[element[convertedItemKey]] || null"
                />
              </div>
            </template>
          </draggable>
        </v-window-item>

        <!-- 外注先 -->
        <v-window-item :value="1" class="fill-height">
          <draggable
            class="fill-height overflow-y-auto pa-2"
            :model-value="filteredOutsourcers"
            :item-key="convertedItemKey"
            :group="{ name: 'workers', pull: 'clone', put: false }"
            :sort="false"
          >
            <template #item="{ element }">
              <div>
                <slot
                  name="outsourcer"
                  :element="element"
                  :rawElement="
                    outsourcersMap[element[convertedItemKey]] || null
                  "
                />
              </div>
            </template>
          </draggable>
        </v-window-item>
      </v-window>
    </div>
    <MoleculesBtnKatakanaFilter
      v-model="selectedCharNumber"
      :items="selectableChars"
    />
  </div>
</template>
