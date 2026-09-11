<script setup>
defineProps({ componentAttrs: { type: Object, default: () => ({}) } });
</script>

<template>
  <v-row>
    <v-col cols="12"><air-checkbox v-bind="componentAttrs.hasSecurityGuardRegistration" /></v-col>
    <v-col cols="12"><air-date-input v-bind="componentAttrs.dateOfSecurityGuardRegistration" /></v-col>
    <v-col cols="12"><air-select v-bind="componentAttrs.bloodType" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.emergencyContactName" /></v-col>
    <v-col cols="12"><air-select v-bind="componentAttrs.emergencyContactRelation" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.emergencyContactRelationDetail" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.emergencyContactAddress" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.emergencyContactPhone" /></v-col>
    <v-col cols="12"><air-text-field v-bind="componentAttrs.domicile" /></v-col>
  </v-row>
</template>
