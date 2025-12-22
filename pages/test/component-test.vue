<script setup>
const search = ref(null);
</script>

<template>
  <v-container>
    <v-card>
      <template #text>
        <air-data-table v-model:search="search" :delay="300" />
        {{ search }}
      </template>
    </v-card>
  </v-container>
</template>
