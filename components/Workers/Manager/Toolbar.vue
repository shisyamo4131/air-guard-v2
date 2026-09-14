<script setup>
/*****************************************************************************
 * @file ./components/Workers/Manager/Toolbar.vue
 * @description WorkersManagerの既定ツールバー
 *****************************************************************************/
import { useDefaults } from "vuetify";
import BtnAddEmployee from "./BtnAddEmployee.vue";
import BtnAddOutsourcer from "./BtnAddOutsourcer.vue";

const _props = defineProps({
  disabled: { type: Boolean, default: false },
  toCreate: { type: Function, required: true },
});
const props = useDefaults(_props, "WorkersManagerToolbar");
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
