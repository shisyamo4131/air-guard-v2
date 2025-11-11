<script setup>
/**
 * @file components/organisms/OperationResultManager.vue
 * @description Component to manage operation results with site selection.
 *
 * @prop {Function} getSite - Function to fetch a site by its ID.
 * @prop {Function} searchSites - Function to search for sites.
 */
defineOptions({ inheritAttrs: false });

/*****************************************************************************
 *  PROPS
 *****************************************************************************/
const props = defineProps({
  getSite: { type: Function, required: true },
  searchSites: { type: Function, required: true },
});
</script>

<template>
  <air-item-manager v-bind="$attrs">
    <template #input.siteId="{ attrs, editMode }">
      <air-autocomplete-api
        v-bind="attrs"
        :api="searchSites"
        clearable
        :disabled="editMode !== 'CREATE'"
        :fetchItemByKeyApi="getSite"
        item-title="name"
        item-value="docId"
        label="現場"
        required
      />
    </template>
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
