<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Worker/CustomInput.vue
 * @description 作業員情報登録用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import EmployeeAutocomplete from "@/components/Employee/Autocomplete.vue";
import OutsourcerAutocomplete from "@/components/Outsourcer/Autocomplete.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "OperationResultWorkerCustomInput");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const isEmployee = computed(() => {
  return props.componentAttrs.isEmployee.modelValue;
});
const idLabel = computed(() => {
  return isEmployee.value ? "従業員" : "外注先";
});
const autocomplete = computed(() => {
  return isEmployee.value ? EmployeeAutocomplete : OutsourcerAutocomplete;
});
</script>

<template>
  <v-row>
    <v-col cols="12">
      <component
        :is="autocomplete"
        v-bind="props.componentAttrs['id']"
        :label="idLabel"
        required
      />
    </v-col>
    <v-col cols="12" md="6">
      <air-time-picker-input v-bind="props.componentAttrs['startTime']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-time-picker-input v-bind="props.componentAttrs['endTime']" />
    </v-col>
    <v-col cols="12">
      <is-start-next-day-checkbox
        v-bind="props.componentAttrs['isStartNextDay']"
      />
    </v-col>
    <v-col cols="12" md="6">
      <air-number-input v-bind="props.componentAttrs['breakMinutes']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-number-input
        v-bind="props.componentAttrs['regulationWorkMinutes']"
      />
    </v-col>
    <v-col cols="6">
      <air-checkbox v-bind="props.componentAttrs['isQualified']" />
    </v-col>
    <v-col cols="6">
      <air-checkbox v-bind="props.componentAttrs['isOjt']" />
    </v-col>
  </v-row>
</template>
