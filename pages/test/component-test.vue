<script setup>
import { mockEmployees } from "@/mocks/employees.js";

const employees = mockEmployees;
</script>

<template>
  <TemplatesFixedHeightContainer>
    <EmployeesManager
      :model-value="employees"
      class="fill-height"
      :employees="employees"
      hide-default-footer
      :items-per-page="-1"
    />
  </TemplatesFixedHeightContainer>
</template>

<style scoped></style>
