<script setup>
/**
 * @file components/organisms/SiteOperationScheduleDetailManager.vue
 * @description A component for managing single site operation schedule detail (worker).
 */
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
    :dialog-props="{
      maxWidth: 360,
    }"
    disable-delete
    :input-props="{
      includedKeys: [
        'startTime',
        'isStartNextDay',
        'endTime',
        'breakMinutes',
        'isQualified',
      ],
    }"
  >
    <template #input.isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
    <template #input.isQualified="{ attrs, item, updateProperties }">
      <div class="d-flex">
        <air-checkbox v-bind="attrs" class="mr-4" />
        <air-checkbox
          :model-value="item.isOjt"
          label="OJT"
          @update:model-value="(value) => updateProperties({ isOjt: value })"
        />
      </div>
    </template>
  </air-item-manager>
</template>
