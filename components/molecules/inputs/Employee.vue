<script setup>
const props = defineProps({
  type: { type: String, default: "default" },
  componentAttrs: { type: Object, default: () => ({}) },
});
</script>

<template>
  <!-- COMMENT -->
  <div v-if="type === 'default'">
    <v-row>
      <v-col cols="12" md="6">
        <air-text-field v-bind="componentAttrs['lastName']" />
      </v-col>
      <v-col cols="12" md="6">
        <air-text-field v-bind="componentAttrs['firstName']" />
      </v-col>
      <v-col cols="12" md="6">
        <air-text-field v-bind="componentAttrs['lastNameKana']" />
      </v-col>
      <v-col cols="12" md="6">
        <air-text-field v-bind="componentAttrs['firstNameKana']" />
      </v-col>
      <v-col cols="12">
        <air-text-field v-bind="componentAttrs['displayName']" />
      </v-col>
      <v-col cols="12">
        <air-text-field v-bind="componentAttrs['title']" />
      </v-col>
      <v-col cols="12">
        <air-select v-bind="componentAttrs['gender']" />
      </v-col>
      <v-col cols="12">
        <air-date-input v-bind="componentAttrs['dateOfBirth']" />
      </v-col>
      <v-col cols="12">
        <air-postal-code v-bind="componentAttrs['zipcode']" />
      </v-col>
      <v-col cols="12">
        <air-select v-bind="componentAttrs['prefCode']" />
      </v-col>
      <v-col cols="12">
        <air-text-field v-bind="componentAttrs['city']" />
      </v-col>
      <v-col cols="12">
        <air-text-field v-bind="componentAttrs['address']" />
      </v-col>
      <v-col cols="12">
        <air-text-field v-bind="componentAttrs['mobile']" />
      </v-col>
      <v-col cols="12">
        <air-text-field v-bind="componentAttrs['email']" />
      </v-col>
      <v-col cols="12">
        <air-date-input v-bind="componentAttrs['dateOfHire']" />
      </v-col>
    </v-row>
  </div>
</template>
