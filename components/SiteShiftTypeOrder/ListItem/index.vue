<script setup>
/*****************************************************************************
 * SiteShiftTypeOrderListItem.vue
 *
 * @property {String} shiftType - The shift type identifier
 * @property {String} siteId - The site identifier
 * @property {Object} fetchSiteComposable - Optional composable for fetching site data
 *
 * @slots prepend - Slot for content to be placed before the title (default: Shift Type Chip)
 * @slots append - Slot for content to be placed after the title
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/** SETUP PROPS */
const _props = defineProps({
  shiftType: { type: String, required: true },
  siteId: { type: String, required: true },
  fetchSiteComposable: { type: Object, default: undefined },
});
const props = useDefaults(_props, "SiteShiftTypeOrderListItem");

/** SETUP COMPOSABLES */
const { attrs } = useIndex(props);
</script>

<template>
  <v-list-item v-bind="attrs">
    <template #prepend="slotProps">
      <slot name="prepend" v-bind="slotProps || {}">
        <AtomsChipsShiftType class="mr-2" :shift-type="props.shiftType" />
      </slot>
    </template>
    <template #title="{ title }">
      <span>{{ title }}</span>
    </template>
    <template v-if="$slots.append" #append="slotProps">
      <slot name="append" v-bind="slotProps || {}" />
    </template>
  </v-list-item>
</template>
