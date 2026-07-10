<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationScheduleDetail/Manager/index.vue
 * @description 現場稼働予定詳細管理用コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/SiteOperationScheduleDetail/CustomInput";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteOperationScheduleDetailManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
});
const props = useDefaults(_props, "SiteOperationScheduleDetailManager");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SiteOperationScheduleDetailManager");

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
    v-bind="{ ...$attrs, ...attrs }"
    ref="component"
    :custom-input="props.customInput"
    :dialog-props="{ maxWidth: 360 }"
  />
</template>
