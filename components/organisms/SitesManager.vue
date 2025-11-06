<script setup>
/**
 * @file components/organisms/SitesManager.vue
 * @description A component to manage sites.
 * @author shisyamo4131
 */
</script>

<template>
  <air-array-manager>
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
