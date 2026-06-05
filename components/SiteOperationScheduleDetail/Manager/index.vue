<script setup>
/*****************************************************************************
 * @file components/SiteOperationScheduleDetail/Manager/index.vue
 * @description A component for managing single site operation schedule detail.
 * @extends AirItemManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import CustomInput from "@/components/SiteOperationScheduleDetail/CustomInput";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteOperationScheduleDetailManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
});
const props = useDefaults(_props, "SiteOperationScheduleDetailManager");

/*****************************************************************************
 * TEMPLATE REF
 *****************************************************************************/
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
    v-bind="$attrs"
    ref="component"
    :custom-input="CustomInput"
    :dialog-props="{ maxWidth: 360 }"
  />
</template>
