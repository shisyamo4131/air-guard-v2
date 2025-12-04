<script setup>
/**
 * @file components/organisms/SiteOperationScheduleManager.vue
 * @description A component for managing single site operation schedule.
 */
import { useFetchSite } from "@/composables/fetch/useFetchSite";

const props = defineProps({
  fetchSiteComposable: { type: Object, default: () => useFetchSite() },
});

const component = useTemplateRef("component");

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
});
</script>

<template>
  <air-item-manager ref="component">
    <template #input.siteId="{ attrs }">
      <MoleculesAutocompleteSite
        v-bind="attrs"
        creatable
        :fetch-site-composable="fetchSiteComposable"
      />
    </template>
    <template #input.isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
  </air-item-manager>
</template>
