<script setup>
/*****************************************************************************
 * @file ./components/Customer/ListItem/index.vue
 * @description A ListItem component of Customer.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Customer } from "@/schemas";

defineOptions({ name: "CustomerListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // ListItem
});
const props = useDefaults(_props, "CustomerListItem");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalItem = reactive(new Customer());
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
/**
 * Returns `abbreviation` used to `title` of `VListItem`.
 */
const title = computed(() => {
  return internalItem.abbreviation || "N/A";
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
