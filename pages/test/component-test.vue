<script setup>
import { Employee } from "@/schemas";

const employee = reactive(new Employee());

employee.subscribe({ docId: "Kv6E41EX6TlZT8DkGXfW" });
</script>

<template>
  <v-container>
    <v-card>
      <EmployeeListItem :item="employee" />
    </v-card>
  </v-container>
</template>
