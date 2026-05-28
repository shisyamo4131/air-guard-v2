<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
const auth = useAuthStore();
const selectedItem = ref(null);
</script>

<template>
  <v-container>
    <SiteAutocomplete v-model="selectedItem" />
  </v-container>
</template>
