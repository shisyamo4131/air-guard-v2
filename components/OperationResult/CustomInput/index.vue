<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/CustomInput/index.vue
 * @description 稼働実績登録用のカスタム入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "OperationResultCustomInput");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch("OperationResultCustomInput");
</script>

<template>
  <v-row>
    <v-col cols="12">
      <SiteAutocomplete
        v-bind="props.componentAttrs['siteId']"
        creatable
        :fetch-site-composable="fetchSiteComposable"
      />
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="props.componentAttrs['dateAt']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-select v-bind="props.componentAttrs['dayType']" />
    </v-col>
    <v-col cols="12" md="6">
      <air-select v-bind="props.componentAttrs['shiftType']" />
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
    <v-col cols="12">
      <air-number-input v-bind="props.componentAttrs['requiredPersonnel']" />
    </v-col>
    <v-col cols="12">
      <air-checkbox v-bind="props.componentAttrs['qualificationRequired']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="props.componentAttrs['workDescription']" />
    </v-col>
    <v-col cols="12">
      <air-textarea v-bind="props.componentAttrs['remarks']" />
    </v-col>
  </v-row>
</template>
