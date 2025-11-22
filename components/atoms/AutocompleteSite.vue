<script setup>
const props = defineProps({
  label: { type: String, default: "現場" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
});

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
  />
</template>
