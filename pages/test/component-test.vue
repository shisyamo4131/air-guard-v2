<script setup>
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();
const selectedAgreement = ref(null);
const returnObject = ref(true);
</script>

<template>
  <div style="width: 100%; height: 360px; border: 1px solid gray">
    <AgreementsIterator :agreements="auth.company.agreements" />
  </div>
</template>
