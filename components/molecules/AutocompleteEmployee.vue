<script setup>
import { useFetchEmployee } from "@/composables/fetch/useFetchEmployee";

/** DEFINE PROPS & EMITS */
const props = defineProps({
  fetchEmployeeComposable: { type: Object, default: () => useFetchEmployee() },
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "従業員" },
  itemTitle: { type: String, default: "displayName" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});

const emit = defineEmits(["update:model-value"]);

/** SETUP COMPOSABLES */
const { getEmployee, searchEmployees, cachedEmployeesArray } =
  props.fetchEmployeeComposable;

function onCreateHandler(event) {
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}
</script>

<template>
  <air-autocomplete-api
    :api="searchEmployees"
    :fetchItemByKeyApi="getEmployee"
    :items="cachedEmployeesArray"
    cache-items
    hint="名称入力で検索"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    persistent-hint
    :return-object="returnObject"
    @update:model-value="emit('update:model-value', $event)"
  >
    <template v-if="creatable" #append>
      <EmployeeManager @create="($event) => onCreateHandler($event)">
        <template #activator="{ toCreate }">
          <v-icon @click="toCreate()">mdi-plus</v-icon>
        </template>
      </EmployeeManager>
    </template>
    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
