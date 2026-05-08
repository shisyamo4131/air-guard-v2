<script setup>
/*****************************************************************************
 * @file ./components/Employee/CustomInput/Resignation.vue
 * @description A custom input component to input `Resignation` information.
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, required: true },
});
useDefaults(_props, "EmployeeCustomInputResignation");
</script>

<template>
  <v-row>
    <v-col cols="12">
      <air-date-input v-bind="componentAttrs['dateOfHire']" readonly />
    </v-col>
    <v-col cols="12">
      <air-date-input
        v-bind="componentAttrs['dateOfTermination']"
        required
        :rules="[
          (v) =>
            (!!v && v >= componentAttrs['dateOfHire'].modelValue) ||
            '退職日は入社日以降の日付を指定してください。',
        ]"
      />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="componentAttrs['reasonOfTermination']" required />
    </v-col>
    <v-col cols="12">
      <v-alert type="warning" density="compact">
        退職処理を行うと、在職中に戻すことはできません。
      </v-alert>
    </v-col>
  </v-row>
</template>
