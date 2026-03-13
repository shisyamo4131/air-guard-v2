<script setup>
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();
const selectedAgreement = ref(null);
const returnObject = ref(true);
</script>

<template>
  <div style="width: 100%; height: 360px; border: 1px solid gray">
    <v-card>
      <v-empty-state color="primary" text="新規登録" icon="mdi-plus" />
    </v-card>
  </div>
</template>
