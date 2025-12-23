<script setup>
const emit = defineEmits(["click:site-order", "click:add-schedule"]);

const open = ref(false);
const btns = ref([
  {
    icon: "mdi-sort",
    color: "info",
    onClick: () => emit("click:site-order"),
  },
  {
    icon: "mdi-plus",
    color: "secondary",
    onClick: () => emit("click:add-schedule"),
  },
]);
</script>

<template>
  <v-fab app icon variant="elevated">
    <v-icon>{{ open ? "mdi-close" : "mdi-plus" }}</v-icon>
    <v-speed-dial v-model="open" activator="parent">
      <v-btn v-for="(btn, index) in btns" :key="index" v-bind="btn" />
    </v-speed-dial>
  </v-fab>
</template>
