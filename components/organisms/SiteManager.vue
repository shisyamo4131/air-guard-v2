<script setup>
/**
 * @file components/organisms/SiteManager.vue
 * @description A component to manage site.
 * @author shisyamo4131
 */
</script>

<template>
  <air-item-manager>
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>

<style scoped></style>
