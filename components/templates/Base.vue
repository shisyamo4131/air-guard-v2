<script setup>
/**
 * @file components/templates/Base.vue
 * @description
 *
 */
import { useDisplay } from "vuetify";
const { mobile } = useDisplay();

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  color: { type: String, default: "primary" },
  fixed: { type: Boolean, default: false },
  height: {
    type: [String, Number],
    default: "calc(100vh - var(--app-bar-height) - var(--footer-height))",
  },
  hideToolbar: { type: Boolean, default: false },
  label: { type: String, default: undefined },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const containerStyle = computed(() => {
  if (!props.fixed) return {};
  const effectiveHeight =
    typeof props.height === "number" ? `${props.height}px` : props.height;
  return {
    height: effectiveHeight,
  };
});

const toolbarDensity = computed(() => {
  return mobile.value ? "compact" : "default";
});
</script>

<template>
  <v-container class="d-flex flex-column" :style="containerStyle">
    <v-toolbar
      v-if="!hideToolbar"
      class="mb-4"
      :color="color"
      :density="toolbarDensity"
    >
      <slot name="prepend-toolbar" />
      <v-toolbar-title>{{ label }}</v-toolbar-title>
      <slot name="append-toolbar" />
    </v-toolbar>
    <div class="flex-grow-1 overflow-y-auto">
      <slot name="default" />
    </div>
  </v-container>
</template>
