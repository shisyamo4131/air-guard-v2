<script setup>
import { useFetch } from "@/composables/fetch/useFetch";

defineOptions({ name: "operation-schedules-index" });

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
useFetch("operation-schedules-index", true);
</script>

<template>
  <OperationSchedulesManager />
</template>
