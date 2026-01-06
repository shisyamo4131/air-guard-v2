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
/**
 * 当該コンポーネント（テンプレート）を使用した場合に、タブレット・スマホでは
 * 「跳ね返り」効果が発生しないように修正。
 */
// const containerStyle = computed(() => {
//   const effectiveHeight =
//     typeof props.height === "number" ? `${props.height}px` : props.height;
//   return {
//     height: effectiveHeight,
//   };
// });
const containerStyle = computed(() => {
  const effectiveHeight =
    typeof props.height === "number" ? `${props.height}px` : props.height;
  return {
    height: effectiveHeight,
    overflowY: "auto",
    overscrollBehavior: "none",
  };
});
</script>

<template>
  <v-container :style="containerStyle">
    <slot />
  </v-container>
</template>
