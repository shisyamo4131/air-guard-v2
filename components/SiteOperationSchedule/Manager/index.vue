<script setup>
/*****************************************************************************
 * @file components/organisms/SiteOperationScheduleManager.vue
 * @description A component for managing single site operation schedule.
 * @extends AirItemManager
 *****************************************************************************/
import { useFetchSite } from "@/composables/fetch/useFetchSite";
import CustomInput from "@/components/SiteOperationSchedule/CustomInput";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
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
  <air-item-manager
    ref="component"
    :custom-input="CustomInput"
    :disable-update="(item) => !!item.operationResultId"
    :disable-delete="(item) => !!item.operationResultId"
  />
</template>
