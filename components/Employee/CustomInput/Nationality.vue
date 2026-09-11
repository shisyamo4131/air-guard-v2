<script setup>
defineProps({ componentAttrs: { type: Object, default: () => ({}) } });
</script>

<template>
  <v-row>
    <v-col cols="12"><air-checkbox v-bind="componentAttrs.isForeigner" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.nationality" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.foreignName" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.residenceStatus" /></v-col>
    <v-col cols="12"><air-checkbox v-bind="componentAttrs.hasPeriodOfStayLimit" /></v-col>
    <v-col cols="12"><air-date-input v-bind="componentAttrs.periodOfStay" /></v-col>
    <v-col cols="12"><air-checkbox v-bind="componentAttrs.hasWorkRestrictions" /></v-col>
  </v-row>
</template>
