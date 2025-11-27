<script setup>
/**
 * BillingUnitTypeChip.vue
 * @description BillingUnitTypeChip component to display billing unit type as a chip.
 * @version 1.0.0
 * @author shisyamo4131
 */
import { computed } from "vue";
import { useDefaults } from "vuetify";
import { BILLING_UNIT_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useConstants } from "@/composables/useConstants";

/** SETUP PROPS */
const _props = defineProps({
  billingUnitType: {
    type: String,
    required: true,
    validator: (value) => Object.keys(BILLING_UNIT_TYPE_VALUES).includes(value),
  },
});
const props = useDefaults(_props, "AtomsBillingUnitTypeChip");

/** SETUP COMPOSABLES */
const { BILLING_UNIT_TYPE } = useConstants();

/** COMPUTED PROPERTIES */
const text = computed(() => {
  return BILLING_UNIT_TYPE.value[props.billingUnitType]?.title || "ERROR";
});
const color = computed(() => {
  return BILLING_UNIT_TYPE.value[props.billingUnitType]?.color || undefined;
});
</script>

<template>
  <v-chip :color="color" :text="text" />
</template>
