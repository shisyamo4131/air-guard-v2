<script setup>
import { useDefaults } from "vuetify";

/*****************************************************************************
 * @file ./components/atoms/HourInput.vue
 * @description A component for entering the number of hours.
 * @extends AirNumberInput
 * - The entered value is converted to minutes and emitted as `update:modelValue` in minutes.
 *****************************************************************************/

/*****************************************************************************
 * DEFINE MODEL
 *****************************************************************************/
const model = defineModel();

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  precision: { type: [Number, null], default: 1 },
});
const props = useDefaults(_props, "AtomsHourInput");
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const computedModel = computed({
  get() {
    const source = model.value;
    if (source === null || source === undefined) return null;
    if (typeof source !== "number") return null;
    return source / 60;
  },
  set(value) {
    if (value === null || value === undefined) {
      emit("update:modelValue", null);
      return;
    }
    if (typeof value !== "number") {
      emit("update:modelValue", null);
      return;
    }
    const minutes = Math.round(value * 60);
    emit("update:modelValue", minutes);
  },
});
</script>

<template>
  <air-number-input v-model="computedModel" :precision="props.precision">
    <!-- PASS THROUGH SLOTS -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-number-input>
</template>
