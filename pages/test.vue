<script setup>
const events = ref([{ name: "test", start: new Date("2025-09-10") }]);
</script>

<template>
  <v-calendar
    :day-format="({ day }) => day"
    :month-format="({ month }) => `${month}/`"
    :events="events"
  >
  </v-calendar>
</template>
