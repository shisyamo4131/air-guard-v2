<script setup>
import { ref } from "vue";
import { Employee } from "@/schemas/Employee.js";

const employeesTestData = ref([
  {
    code: "EMP001",
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "ヤマダ",
    firstNameKana: "タロウ",
    displayName: "山田 太郎",
    zipcode: "100-0001",
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1",
    building: "宮殿ビル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP002",
    lastName: "佐藤",
    firstName: "花子",
    lastNameKana: "サトウ",
    firstNameKana: "ハナコ",
    displayName: "佐藤 花子",
    zipcode: "530-0001",
    prefCode: "27",
    city: "大阪市北区",
    address: "梅田1-1-1",
    building: "駅前第3ビル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP003",
    lastName: "鈴木",
    firstName: "一郎",
    lastNameKana: "スズキ",
    firstNameKana: "イチロウ",
    displayName: "鈴木 一郎",
    zipcode: "450-0002",
    prefCode: "23",
    city: "名古屋市中村区",
    address: "名駅1-1-4",
    building: "JRセントラルタワーズ",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP004",
    lastName: "高橋",
    firstName: "恵子",
    lastNameKana: "タカハシ",
    firstNameKana: "ケイコ",
    displayName: "高橋 恵子",
    zipcode: "810-0001",
    prefCode: "40",
    city: "福岡市中央区",
    address: "天神1-4-1",
    building: "イムズビル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP005",
    lastName: "田中",
    firstName: "次郎",
    lastNameKana: "タナカ",
    firstNameKana: "ジロウ",
    displayName: "田中 次郎",
    zipcode: "060-0001",
    prefCode: "01",
    city: "札幌市中央区",
    address: "北1条西2丁目",
    building: "時計台ビル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP006",
    lastName: "伊藤",
    firstName: "三郎",
    lastNameKana: "イトウ",
    firstNameKana: "サブロウ",
    displayName: "伊藤 三郎",
    zipcode: "980-0021",
    prefCode: "04",
    city: "仙台市青葉区",
    address: "中央1-2-3",
    building: "SS30",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP007",
    lastName: "渡辺",
    firstName: "直美",
    lastNameKana: "ワタナベ",
    firstNameKana: "ナオミ",
    displayName: "渡辺 直美",
    zipcode: "220-0011",
    prefCode: "14",
    city: "横浜市西区",
    address: "高島2-18-1",
    building: "スカイビル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP008",
    lastName: "山本",
    firstName: "博",
    lastNameKana: "ヤマモト",
    firstNameKana: "ヒロシ",
    displayName: "山本 博",
    zipcode: "730-0011",
    prefCode: "34",
    city: "広島市中区",
    address: "基町6-78",
    building: "NTTクレド基町ビル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP009",
    lastName: "中村",
    firstName: "さくら",
    lastNameKana: "ナカムラ",
    firstNameKana: "サクラ",
    displayName: "中村 さくら",
    zipcode: "600-8216",
    prefCode: "26",
    city: "京都市下京区",
    address: "東塩小路町",
    building: "京都タワーホテル",
    isForeigner: false,
    foreignName: null,
    nationality: null,
  },
  {
    code: "EMP010",
    lastName: "Smith",
    firstName: "John",
    lastNameKana: "スミス",
    firstNameKana: "ジョン",
    displayName: "John Smith",
    zipcode: "90210",
    prefCode: "US",
    city: "Beverly Hills",
    address: "123 Rodeo Drive",
    building: "Luxury Plaza",
    isForeigner: true,
    foreignName: "John Michael Smith",
    nationality: "USA",
  },
]);

const registrationLog = ref([]);
const isLoading = ref(false);

async function registerAllEmployees() {
  if (isLoading.value) return;
  isLoading.value = true;
  registrationLog.value = ["登録処理を開始します..."];

  for (const empData of employeesTestData.value) {
    try {
      const employee = new Employee(empData);
      const documentRef = await employee.create();
      const message = `成功: ${employee.displayName} (Code: ${employee.code}) を登録しました。Doc ID: ${documentRef.id}`;
      registrationLog.value.push(message);
      console.log(message, documentRef);
    } catch (error) {
      const errorMessage = `失敗: ${
        empData.displayName || empData.lastName + " " + empData.firstName
      } (Code: ${empData.code}) の登録中にエラーが発生しました: ${
        error.message
      }`;
      registrationLog.value.push(errorMessage);
      console.error(errorMessage, error);
    }
  }
  registrationLog.value.push("全ての登録処理が完了しました。");
  isLoading.value = false;
}
</script>

<template>
  <v-container>
    <v-card>
      <v-card-title>従業員データ登録テスト</v-card-title>
      <v-card-text>
        <p>
          以下のボタンをクリックすると、10人分のテスト従業員データがFirestoreに登録されます。
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

      <v-divider
        v-if="
          (registrationLog.length > 0 &&
            registrationLog[0] !== '登録処理を開始します...') ||
          isLoading
        "
      ></v-divider>

      <v-card-text
        v-if="
          (registrationLog.length > 0 &&
            registrationLog[0] !== '登録処理を開始します...') ||
          isLoading
        "
      >
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
