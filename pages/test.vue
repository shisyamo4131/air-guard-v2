<script setup>
const dateTime = ref(new Date("2025-07-01T11:00:00"));
</script>

<template>
  <v-container>
    <air-date-time-picker v-model="dateTime" />
  </v-container>
</template>
