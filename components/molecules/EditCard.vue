<script setup>
import { useLogger } from "~/composables/useLogger";

// --- ストア / コンポーザブル
const logger = useLogger();
</script>

<template>
  <air-edit-card :logger="logger" v-slot="slotProps">
    <slot name="default" v-bind="slotProps" />
  </air-edit-card>
</template>
