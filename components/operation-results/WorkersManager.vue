<script setup>
import { OperationResultDetail } from "@/schemas";

const workers = defineModel({ type: Array, default: () => [] });
</script>

<template>
  <air-array-manager :model-value="workers" :schema="OperationResultDetail">
  </air-array-manager>
</template>
