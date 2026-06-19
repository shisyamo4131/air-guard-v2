<script setup>
/*****************************************************************************
 * @file ./components/SiteOperationSchedule/Card/OverAndShortIcon.vue
 * @description SiteOperationScheduleCard 専用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteOperationScheduleCardOverAndShortIcon",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  schedule: {
    type: Object,
    default: () => new SiteOperationSchedule(),
    validator: (val) => val instanceof SiteOperationSchedule,
  },
});
const props = useDefaults(_props, "SiteOperationScheduleCardOverAndShortIcon");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const tooltipMessage = computed(() => {
  if (props.schedule.isPersonnelShortage) {
    return "必要人数を満たしていません。";
  } else if (props.schedule.isPersonnelSurplus) {
    return "必要人数を超えています。";
  } else {
    return "";
  }
});

const color = computed(() => {
  if (props.schedule.isPersonnelShortage) {
    return "error";
  } else if (props.schedule.isPersonnelSurplus) {
    return "warning";
  } else {
    return "";
  }
});
</script>

<template>
  <v-icon
    v-bind="$attrs"
    :color="color"
    icon="mdi-message-alert"
    v-tooltip:top="tooltipMessage"
  />
</template>
