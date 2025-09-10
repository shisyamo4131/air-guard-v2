<script setup>
/**
 * @file components/molecules/EditCard.vue
 * @description A wrapper component for AirEditCard with custom slots.
 */
import { useLogger } from "~/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

// --- ストア / コンポーザブル
const logger = useLogger("MoleculesCardsEdit", useErrorsStore());
</script>

<template>
  <air-edit-card :logger="logger">
    <template #header>
      <slot name="header" />
    </template>
    <template #default="slotProps">
      <slot name="default" v-bind="slotProps" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </air-edit-card>
</template>
