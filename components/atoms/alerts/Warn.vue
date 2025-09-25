<script setup>
/**
 * @file components/atoms/alerts/Warn.vue
 * @description A warning alert component using Vuetify's v-alert.
 *              It displays a warning message with customizable properties.
 */

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  border: { type: Boolean, default: true },
  density: { type: String, default: "compact" },
  variant: { type: String, default: "outlined" },
});
</script>

<template>
  <v-alert v-bind="props" type="warning">
    <template #default>
      <slot name="default" />
    </template>
  </v-alert>
</template>
