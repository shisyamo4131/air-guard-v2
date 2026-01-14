<script setup>
const data = ref(null);
</script>

<template>
  <v-container>
    <v-text-field
      v-model="data"
      :rules="[(v) => (v && v.length >= 2) || 'error']"
    />
  </v-container>
</template>
