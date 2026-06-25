<script setup>
/*****************************************************************************
 * @file ./components/Site/CustomInput/Base.vue
 * @description 現場基本情報用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "SiteCustomInputBase");
</script>

<template>
  <v-row dense>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['code']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['name']" />
    </v-col>
    <v-col cols="12">
      <air-checkbox v-bind="props.componentAttrs['hasAbbreviation']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['abbreviation']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['nameKana']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['zipcode']" />
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
      <air-select v-bind="props.componentAttrs['securityType']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['siteNumber']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-date-input
        v-bind="props.componentAttrs['constructionPeriodStartAt']"
      />
    </v-col>
    <v-col cols="12" md="6">
      <air-date-input
        v-bind="props.componentAttrs['constructionPeriodEndAt']"
      />
    </v-col>
    <v-col cols="12">
      <air-textarea v-bind="props.componentAttrs['remarks']" />
    </v-col>
  </v-row>
</template>
