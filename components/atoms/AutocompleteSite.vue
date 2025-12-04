<script setup>
/**
 * AutocompleteSite.vue
 * @description A component for selecting a site using an autocomplete input.
 * - It utilizes the AirAutocompleteApi component to fetch and display site options.
 * - The component accepts props to customize the label and the fields used for item title and value.
 * - `fetchSiteComposable` must to be provided via Vue's provide/inject mechanism.
 * @author shisyamo413
 */

/** DEFINE PROPS */
const props = defineProps({
  label: { type: String, default: "現場" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
});

/** SETUP COMPOSABLES */
const fetchSiteComposable = inject("fetchSiteComposable");
if (!fetchSiteComposable) {
  throw new Error("fetchSiteComposable is not provided");
}
const { getSite, searchSites } = fetchSiteComposable;
</script>

<template>
  <air-autocomplete-api
    :api="searchSites"
    :fetchItemByKeyApi="getSite"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
  >
    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
