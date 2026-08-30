<script setup>
const emit = defineEmits([
  "click:site-shift-type-order",
  "click:add-schedule",
  "click:workers",
]);

const props = defineProps({
  showSiteShiftTypeOrder: { type: Boolean, default: false },
  siteShiftTypeOrderDisabled: { type: Boolean, default: false },
});

const open = ref(false);
const btns = computed(() => [
  ...(props.showSiteShiftTypeOrder
    ? [
        {
          icon: "mdi-sort",
          color: "info",
          disabled: props.siteShiftTypeOrderDisabled,
          onClick: () => emit("click:site-shift-type-order"),
        },
      ]
    : []),
  {
    icon: "mdi-file-document-plus",
    color: "secondary",
    onClick: () => emit("click:add-schedule"),
  },
  {
    icon: "mdi-account-group",
    color: "success",
    onClick: (event) => emit("click:workers", event),
  },
]);
</script>

<template>
  <v-fab icon variant="elevated">
    <v-icon>{{ open ? "mdi-close" : "mdi-menu" }}</v-icon>
    <v-speed-dial v-model="open" activator="parent">
      <v-btn v-for="(btn, index) in btns" :key="index" v-bind="btn" />
    </v-speed-dial>
  </v-fab>
</template>
