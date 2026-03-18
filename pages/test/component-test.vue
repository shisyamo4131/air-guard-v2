<script setup>
import { mockEmployees } from "@/mocks/employees.js";

const employees = mockEmployees;
</script>

<template>
  <v-container>
    <div class="grid-container">
      <EmployeeCard
        v-for="employee in employees"
        :key="employee.id"
        :employee="employee"
      >
      </EmployeeCard>
    </div>
  </v-container>
</template>

<style scoped>
/* grid container の設定 */
.grid-container {
  display: grid;
  gap: 16px;
  /* 1列あたりの最小幅を252px、最大幅を利用可能なスペース全体に設定 */
  /* 最小幅は AgreementCard の min-width に合わせている */
  /* minmax: 指定した最小値、最大値の範囲内で定義 */
  /* repeat: 繰り返し定義。auto-fill は利用可能なスペースに収まるだけ列を作成する。 */
  /* 結果、親要素の横幅に対して最小幅252pxの列ができるだけ多く配置される */
  grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
}
</style>
