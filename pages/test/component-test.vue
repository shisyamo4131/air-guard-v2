<script setup>
import { Employee } from "@/schemas";

const employee = reactive(new Employee());

employee.subscribe({ docId: "Kv6E41EX6TlZT8DkGXfW" });
</script>

<template>
  <v-container>
    <v-card class="overflow-visible">
      <v-icon icon="mdi-magnify" style="position: absolute; top: -10px" />
      <v-card-title>社員情報</v-card-title>
    </v-card>
  </v-container>
</template>
