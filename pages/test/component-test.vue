<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
const auth = useAuthStore();
const selectedItem = ref(null);
</script>

<template>
  <v-container>
    <air-edit-card>
      <v-toolbar density="compact" color="secondary" />
    </air-edit-card>
  </v-container>
</template>
