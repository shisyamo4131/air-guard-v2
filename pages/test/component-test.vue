<script setup>
const search = ref(null);
</script>

<template>
  <v-container class="d-flex align-center ga-2">
    <air-text-field
      hide-details
      density="compact"
      variant="solo-inverted"
      single-line
    />
    <v-btn icon="mdi-plus" density="comfortable" />
  </v-container>
</template>
