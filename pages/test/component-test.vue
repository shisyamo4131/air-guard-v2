<script setup>
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();
const selectedAgreement = ref(null);
const returnObject = ref(true);
</script>

<template>
  <v-container>
    <AgreementsIterator
      v-model="selectedAgreement"
      :agreements="auth.company.agreements"
      show-select
    />
    <pre>{{ selectedAgreement }}</pre>
  </v-container>
</template>
