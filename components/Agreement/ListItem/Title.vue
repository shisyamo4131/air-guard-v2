<script setup>
/*****************************************************************************
 * @file ./components/Agreement/ListItem/Title.vue
 * @description - A component displaying customized information of `Agreement` for list-item-title.
 * @extends DIV
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { AgreementV2 } from "@/schemas";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "AgreementListItemTitle", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  agreement: {
    type: Object,
    required: true,
    validator: (obj) => obj instanceof AgreementV2,
  },
});
const props = useDefaults(_props, "AgreementListItem");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const title = computed(() => {
  return `適用開始日: ${props.agreement.date}`;
});
const shiftTypeChipAttrs = computed(() => {
  return {
    class: "ms-2",
    shiftType: props.agreement.shiftType,
    label: true,
    size: "x-small",
  };
});
</script>

<template>
  <div class="d-flex align-center">
    <span>{{ title }}</span>
    <ShiftTypeChip v-bind="shiftTypeChipAttrs" />
  </div>
</template>
