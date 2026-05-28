<script setup>
/*****************************************************************************
 * @file ./components/Outsourcer/ListItem/index.vue
 * @description A ListItem component of Outsourcer.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Outsourcer } from "@/schemas";

defineOptions({ name: "OutsourcerListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // ListItem
});
const props = useDefaults(_props, "OutsourcerListItem");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalItem = reactive(new Outsourcer());
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
 * Returns `displayName` used to `title` of `VListItem`.
 * If the outsourcer is a foreigner, returns a string in the format of `displayName(fullName)`.
 */
const title = computed(() => {
  return internalItem.displayName || "N/A";
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
