<script setup>
/**
 * @file components/organisms/SiteOperationScheduleManager.vue
 * @description A component for managing single site operation schedule.
 */
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger(
  "SiteOperationScheduleManager",
  useErrorsStore()
);

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
    :input-props="{
      excludedKeys: [
        'siteId',
        'dayType',
        'shiftType',
        'employees',
        'outsourcers',
      ],
    }"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
    @error="error"
    @error:clear="clearError"
  >
    <template #isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
  </air-item-manager>
</template>
