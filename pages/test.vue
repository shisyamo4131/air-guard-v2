<script setup>
import { Employee } from "@/schemas/Employee.js";
import { employeeTestDataArray } from "@/data/testData/employees.js"; // データファイルをインポート
import { useTestDataRegistrar } from "@/composables/useTestDataRegistrar.js"; // コンポーザブルをインポート

const { registrationLog, isLoading, registerItems } = useTestDataRegistrar();

async function registerAllEmployees() {
  await registerItems({
    items: employeeTestDataArray,
    itemConstructor: Employee,
    itemName: "従業員",
  });
}
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>従業員データ登録テスト</v-card-title>
      <v-card-text>
        <p>
          以下のボタンをクリックすると、テスト従業員データがFirestoreに登録されます。
        </p>
        <p>（Employeeクラスのcreateメソッドを利用）</p>
      </v-card-text>
      <v-card-actions>
        <v-btn
          color="primary"
          @click="registerAllEmployees"
          :loading="isLoading"
          :disabled="isLoading"
        >
          全従業員データを登録
        </v-btn>
      </v-card-actions>

      <v-divider v-if="registrationLog.length > 0 || isLoading"></v-divider>

      <v-card-text v-if="registrationLog.length > 0 || isLoading">
        <p><strong>登録ログ:</strong></p>
        <div
          style="
            max-height: 300px;
            overflow-y: auto;
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
          "
        >
          <div
            v-for="(logEntry, index) in registrationLog"
            :key="index"
            style="font-family: monospace; white-space: pre-wrap"
          >
            {{ logEntry }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>
