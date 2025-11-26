<script setup>
import { useAuthStore } from "@/stores/useAuthStore";

const { company } = useAuthStore();
</script>

<template>
  <v-container>
    <MoleculesCardsAgreementSelector :items="company.agreements" clearable />
  </v-container>
</template>
