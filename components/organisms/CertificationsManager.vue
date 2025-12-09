<script setup>
/**
 * @file components/organisms/CertificationsManager.vue
 * @description A component to manage certifications based on `AirArrayManager`.
 * - Provides a UI for selecting existing certifications.
 */
</script>

<template>
  <air-array-manager>
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
