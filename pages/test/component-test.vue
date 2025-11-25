<script setup>
import { useAuthStore } from "@/stores/useAuthStore";

const { company } = useAuthStore();
</script>

<template>
  <MoleculesCardsAgreementSelector :items="company.agreements" />
</template>
