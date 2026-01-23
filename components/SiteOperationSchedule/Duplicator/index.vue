<script setup>
/***************************************************************************
 * SiteOperationScheduleDuplicator
 * @version 1.0.0
 * @description A component to duplicate site operation schedules.
 * @author shisyamo4131
 ***************************************************************************/

/***************************************************************************
 * DEFINE OPTIONS
 ***************************************************************************/
defineOptions({ inheritAttrs: false });

/***************************************************************************
 * SETUP PROPS & EMITS
 ***************************************************************************/
const props = defineProps({
  allowedDates: { type: Function, default: () => true },
  selectedDates: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:selected-dates"]);

/***************************************************************************
 * SETUP EXPOSE
 ***************************************************************************/
const component = useTemplateRef("component");
defineExpose({
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
});
</script>

<template>
  <air-item-manager ref="component" v-bind="$attrs">
    <template #input>
      <v-date-picker
        :model-value="selectedDates"
        :allowed-dates="allowedDates"
        hide-header
        multiple
        @update:model-value="emit('update:selected-dates', $event)"
      />
    </template>
  </air-item-manager>
</template>
