<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Workers/Manager/Toolbar.vue
 * @description A toolbar component for `OperationResultWorkersManager`.
 *
 * @property {Boolean} disabled
 * - A flag to disable the toolbar buttons, typically used when the parent component is in a locked state.
 * @property {Function} toCreate
 * - A function passed from `OperationResultWorkersManager` to handle the creation of new worker entries.
 *****************************************************************************/
import { useDefaults } from "vuetify";
// COMPONENTS
import BtnAddEmployee from "./BtnAddEmployee.vue";
import BtnAddOutsourcer from "./BtnAddOutsourcer.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  disabled: { type: Boolean, default: false },
  toCreate: { type: Function, required: true },
});
const props = useDefaults(_props, "OperationResultWorkersManagerToolbar");
</script>

<template>
  <v-toolbar color="secondary" title="作業員" density="compact">
    <BtnAddEmployee
      :disabled="props.disabled"
      @click="() => props.toCreate({ isEmployee: true })"
    />
    <BtnAddOutsourcer
      :disabled="props.disabled"
      @click="() => props.toCreate({ isEmployee: false })"
    />
  </v-toolbar>
</template>
