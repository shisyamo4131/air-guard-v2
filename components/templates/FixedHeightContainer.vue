<script setup>
/**
 * @file components/templates/FixedHeightContainer.vue
 * @description A container component that maintains a fixed height, accounting
 *              for the app bar and footer heights. The height can be customized
 *              via props.
 */

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  height: {
    type: String,
    default: "calc(100vh - var(--app-bar-height) - var(--footer-height))",
  },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const containerStyle = computed(() => ({
  height: props.height,
}));
</script>

<template>
  <div :style="containerStyle">
    <slot />
  </div>
</template>
