<script setup>
/*****************************************************************************
 * @file ./components/Employee/ListItem/index.vue
 * @description A ListItem component of Employee.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Employee } from "@/schemas";

defineOptions({ name: "EmployeeListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // ListItem
});
const props = useDefaults(_props, "EmployeeListItem");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalItem = reactive(new Employee());
watch(
  () => props.item,
  (newValue) => {
    internalItem.initialize(newValue?.raw || newValue || null);
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const isForeigner = computed(() => internalItem.isForeigner);

/**
 * Returns `displayName` used to `title` of `VListItem`.
 * If the employee is a foreigner, returns a string in the format of `displayName(fullName)`.
 */
const title = computed(() => {
  const displayName = internalItem.displayName || "N/A";
  const fullName = internalItem.fullName || "N/A";
  return isForeigner.value ? `${displayName} (${fullName})` : displayName;
});
</script>

<template>
  <v-list-item v-bind="$attrs" :title="title">
    <!-- SUBTITLE -->
    <!-- Option 1: Use `subtitle` prop for a single line. -->
    <!-- <v-list-item v-bind="$attrs" :subtitle="internalItem.someProperty"> -->

    <!-- Option 2: Use `v-list-item-subtitle` for multiple lines (idiomatic Vuetify). -->
    <!-- <v-list-item-subtitle>{{ internalItem.someProperty1 }}</v-list-item-subtitle> -->
    <!-- <v-list-item-subtitle>{{ internalItem.someProperty2 }}</v-list-item-subtitle> -->
  </v-list-item>
</template>
