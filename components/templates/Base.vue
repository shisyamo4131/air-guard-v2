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
  <v-container class="d-flex flex-column" :style="containerStyle" fluid>
    <v-toolbar
      v-if="props.label"
      class="mb-4"
      :color="color"
      :density="toolbarDensity"
    >
      <slot name="prepend-toolbar" />
      <v-toolbar-title>{{ label }}</v-toolbar-title>
      <slot name="append-toolbar" />
    </v-toolbar>
    <v-container class="flex-grow-1 overflow-y-auto pa-0" fluid>
      <slot name="default" />
    </v-container>
  </v-container>
</template>
