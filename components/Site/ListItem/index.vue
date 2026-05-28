<script setup>
/*****************************************************************************
 * @file ./components/Site/ListItem/index.vue
 * @description A ListItem component of Site.
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";

defineOptions({ name: "SiteListItem", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // ListItem
});
const props = useDefaults(_props, "SiteListItem");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalItem = reactive(new Site());
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
 * Returns `name` used to `title` of `VListItem`.
 */
const title = computed(() => {
  return internalItem.name || "N/A";
});

const subtitle = computed(() => {
  const customer = internalItem.customer?.abbreviation || "N/A";
  return customer;
});
</script>

<template>
  <v-list-item v-bind="$attrs" :title="title" :subtitle="subtitle">
    <!-- SUBTITLE -->
    <!-- Option 1: Use `subtitle` prop for a single line. -->
    <!-- <v-list-item v-bind="$attrs" :subtitle="internalItem.someProperty"> -->

    <!-- Option 2: Use `v-list-item-subtitle` for multiple lines (idiomatic Vuetify). -->
    <!-- <v-list-item-subtitle>{{ internalItem.someProperty1 }}</v-list-item-subtitle> -->
    <!-- <v-list-item-subtitle>{{ internalItem.someProperty2 }}</v-list-item-subtitle> -->
  </v-list-item>
</template>
