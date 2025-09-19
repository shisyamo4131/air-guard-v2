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
    type: [String, Number],
    default: "calc(100vh - var(--app-bar-height) - var(--footer-height))",
  },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const containerStyle = computed(() => {
  const effectiveHeight =
    typeof props.height === "number" ? `${props.height}px` : props.height;
  return {
    height: effectiveHeight,
  };
});
</script>

<template>
  <v-container :style="containerStyle">
    <slot />
  </v-container>
</template>
