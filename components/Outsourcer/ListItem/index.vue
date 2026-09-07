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
const isTerminated = computed(
  () => internalItem.contractStatus === Outsourcer.STATUS_TERMINATED,
);
</script>

<template>
  <v-list-item v-bind="$attrs" :title="undefined" :subtitle="undefined">
    <v-list-item-title class="d-flex align-center ga-2">
      <span>{{ title }}</span>
      <v-chip
        v-if="isTerminated"
        color="warning"
        size="x-small"
        variant="tonal"
      >
        契約終了
      </v-chip>
    </v-list-item-title>
    <v-list-item-subtitle>{{ internalItem.name }}</v-list-item-subtitle>
    <v-list-item-subtitle>
      コード: {{ internalItem.code || "―" }}
    </v-list-item-subtitle>
  </v-list-item>
</template>
