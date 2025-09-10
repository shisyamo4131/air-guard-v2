<script setup>
/**
 * @file components/organisms/AgreementsManager.vue
 * @description A component to manage agreements.
 */
import { Agreement } from "@/schemas";
import { useLogger } from "../composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";

/*****************************************************************************
 * DEFINE COMPOSABLES
 *****************************************************************************/
const { error, clearError } = useLogger("AgreementsManager", useErrorsStore());

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const model = defineModel({ type: Array, default: () => [] });
</script>

<template>
  <air-array-manager
    v-model="model"
    :schema="Agreement"
    label="取極め"
    :table-props="{
      hideDefaultFooter: true,
      itemsPerPage: -1,
      sortBy: [{ key: 'from', order: 'desc' }],
    }"
    @error="error"
    @error:clear="clearError"
  >
  </air-array-manager>
</template>
