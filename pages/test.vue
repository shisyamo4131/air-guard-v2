<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
const auth = useAuthStore();
</script>

<template>
  <v-container>
    <OrganismsAgreementSelector
      :items="auth.company.agreements"
      @select="console.log($event)"
    />
  </v-container>
</template>
