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
  /** 過不足判定の上書き値。未指定ならスケジュールの従来値を使用します。 */
  assignedPersonnelCount: { type: Number, default: null },
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
const effectiveAssignedPersonnelCount = computed(
  () =>
    props.assignedPersonnelCount ?? props.schedule.assignedPersonnelCount,
);
const requiredPersonnel = computed(
  () => Number(props.schedule.requiredPersonnel) || 0,
);
const isPersonnelShortage = computed(
  () => effectiveAssignedPersonnelCount.value < requiredPersonnel.value,
);
const isPersonnelSurplus = computed(
  () => effectiveAssignedPersonnelCount.value > requiredPersonnel.value,
);

const tooltipMessage = computed(() => {
  if (isPersonnelShortage.value) {
    return "必要人数を満たしていません。";
  } else if (isPersonnelSurplus.value) {
    return "必要人数を超えています。";
  } else {
    return "";
  }
});

const color = computed(() => {
  if (isPersonnelShortage.value) {
    return "error";
  } else if (isPersonnelSurplus.value) {
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
