<script setup>
/*****************************************************************************
 * @file ./components/Employee/CustomInput/ToRegist.vue
 * @description 従業員情報登録用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "EmployeeCustomInputToRegist");
</script>

<template>
  <v-row>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['code']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-text-field v-bind="props.componentAttrs['lastName']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-text-field v-bind="props.componentAttrs['firstName']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-text-field v-bind="props.componentAttrs['lastNameKana']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-text-field v-bind="props.componentAttrs['firstNameKana']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['displayName']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['displayNameKana']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['title']" />
    </v-col>
    <v-col cols="12">
      <air-select v-bind="props.componentAttrs['gender']" />
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="props.componentAttrs['dateOfBirth']" />
    </v-col>
    <v-col cols="12">
      <air-postal-code v-bind="props.componentAttrs['zipcode']" />
    </v-col>
    <v-col cols="12">
      <air-select v-bind="props.componentAttrs['prefCode']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['city']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['address']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['building']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['mobile']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['email']" />
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="props.componentAttrs['dateOfHire']" />
    </v-col>
  </v-row>
</template>
