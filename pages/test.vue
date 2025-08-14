<script setup>
import { SiteOperationSchedule } from "@/schemas";

const model = reactive(new SiteOperationSchedule());
</script>

<template>
  <v-container>
    {{ model }}
  </v-container>
</template>
