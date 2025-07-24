<script setup>
/** define props */
const props = defineProps({
  direction: { type: String, default: "left" },
  disabledEmployee: { type: Boolean, default: false },
  disabledOutsourcer: { type: Boolean, default: false },
  disabledCopy: { type: Boolean, default: false },
  disabledPaste: { type: Boolean, default: false },
  transition: { type: String, default: "slide-x-reverse-transition" },
});

/** define emits */
const emit = defineEmits([
  "click:add-employee",
  "click:add-outsourcer",
  "click:copy",
  "click:paste",
]);

/** define constants */
const fab = ref(false);
const btns = ref([
  {
    icon: "mdi-account",
    onClick: () => emit("click:add-employee"),
    disabled: props.disabledEmployee,
  },
  {
    icon: "mdi-handshake",
    onClick: () => emit("click:add-outsourcer"),
    disabled: props.disabledOutsourcer,
  },
  {
    icon: "mdi-content-copy",
    onClick: () => emit("click:copy"),
    disabled: props.disabledCopy,
  },
  {
    icon: "mdi-content-paste",
    onClick: () => emit("click:paste"),
    disabled: props.disabledPaste,
  },
]);
</script>

<template>
  <v-speed-dial v-model="fab" v-bind="props" location="left center">
    <template #activator="{ props: activatorProps }">
      <v-btn
        v-bind="activatorProps"
        size="x-small"
        :icon="fab ? 'mdi-close' : 'mdi-plus'"
        variant="elevated"
      />
    </template>
    <v-btn
      v-for="(btn, index) in btns"
      :key="index"
      v-bind="btn"
      size="x-small"
    />
  </v-speed-dial>
</template>
