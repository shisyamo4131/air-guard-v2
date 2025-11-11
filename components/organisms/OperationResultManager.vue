<script setup>
/**
 * @file components/organisms/OperationResultManager.vue
 * @description Component to manage operation results with site selection.
 * @author shisyamo4131
 *
 * @note This component depends on the fetchSiteComposable.
 */
defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { getSite, searchSites } = inject("fetchSiteComposable");

/*****************************************************************************
 *  PROPS
 *****************************************************************************/
const props = defineProps({});
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
