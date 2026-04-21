<script setup>
/**
 * Employee 国籍情報・警備員資格情報の validator 検証コンポーネント
 *
 * 【国籍情報】
 * 1. isForeigner = true, foreignName = null → エラー
 * 2. isForeigner = true, nationality = null → エラー
 * 3. isForeigner = true, residenceStatus = null → エラー
 * 4. isForeigner = true + hasPeriodOfStayLimit = true, periodOfStay = null → エラー
 * 5. isForeigner = true, すべて正常 → エラーなし
 * 6. isForeigner = false → エラーなし
 *
 * 【警備員資格情報】
 * 7. hasSecurityGuardRegistration = true, dateOfSecurityGuardRegistration = null → エラー
 * 8. hasSecurityGuardRegistration = true, bloodType = null → エラー
 * 9. hasSecurityGuardRegistration = true, emergencyContactName = null → エラー
 * 10. hasSecurityGuardRegistration = true, emergencyContactRelation = null → エラー
 * 11. hasSecurityGuardRegistration = true, emergencyContactRelationDetail = null → エラー
 * 12. hasSecurityGuardRegistration = true, emergencyContactAddress = null → エラー
 * 13. hasSecurityGuardRegistration = true, emergencyContactPhone = null → エラー
 * 14. hasSecurityGuardRegistration = true, domicile = null → エラー
 * 15. hasSecurityGuardRegistration = true, すべて正常 → エラーなし
 * 16. hasSecurityGuardRegistration = false → エラーなし
 */
import { ref, computed } from "vue";
import { Employee } from "@/schemas";
import {
  BLOOD_TYPE_VALUES,
  EMERGENCY_CONTACT_RELATION_VALUES,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

// 基本的な従業員データを生成するヘルパー関数
const createBaseEmployee = (overrides = {}) => {
  return new Employee({
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "やまだ",
    firstNameKana: "たろう",
    displayName: "山田太郎",
    gender: "male",
    dateOfBirth: new Date("1990-01-01"),
    zipcode: "1000001",
    prefCode: "13",
    city: "千代田区",
    address: "千代田1-1-1",
    dateOfHire: new Date("2020-04-01"),
    employmentStatus: "active",
    ...overrides,
  });
};

// テストケース定義
const testCases = ref([
  // ========== 国籍情報のテスト ==========
  {
    id: 1,
    category: "国籍情報",
    description: "外国籍 + 外国名が null",
    employee: createBaseEmployee({
      isForeigner: true,
      foreignName: null,
      nationality: "USA",
      residenceStatus: "永住者",
    }),
    targetField: "foreignName",
    expectedErrorCount: 1,
    expectedErrorCode: "FOREIGN_NAME_REQUIRED",
  },
  {
    id: 2,
    category: "国籍情報",
    description: "外国籍 + 国籍が null",
    employee: createBaseEmployee({
      isForeigner: true,
      foreignName: "John Doe",
      nationality: null,
      residenceStatus: "永住者",
    }),
    targetField: "nationality",
    expectedErrorCount: 1,
    expectedErrorCode: "NATIONALITY_REQUIRED",
  },
  {
    id: 3,
    category: "国籍情報",
    description: "外国籍 + 在留資格が null",
    employee: createBaseEmployee({
      isForeigner: true,
      foreignName: "John Doe",
      nationality: "USA",
      residenceStatus: null,
    }),
    targetField: "residenceStatus",
    expectedErrorCount: 1,
    expectedErrorCode: "RESIDENCE_STATUS_REQUIRED",
  },
  {
    id: 4,
    category: "国籍情報",
    description: "外国籍 + 在留期間制限あり + 在留期間満了日が null",
    employee: createBaseEmployee({
      isForeigner: true,
      foreignName: "John Doe",
      nationality: "USA",
      residenceStatus: "技術・人文知識・国際業務",
      hasPeriodOfStayLimit: true,
      periodOfStay: null,
    }),
    targetField: "periodOfStay",
    expectedErrorCount: 1,
    expectedErrorCode: "PERIOD_OF_STAY_REQUIRED",
  },
  {
    id: 5,
    category: "国籍情報",
    description: "外国籍 + すべて正常",
    employee: createBaseEmployee({
      isForeigner: true,
      foreignName: "John Doe",
      nationality: "USA",
      residenceStatus: "技術・人文知識・国際業務",
      hasPeriodOfStayLimit: true,
      periodOfStay: new Date("2027-12-31"),
    }),
    targetField: null,
    expectedErrorCount: 0,
    expectedErrorCode: null,
  },
  {
    id: 6,
    category: "国籍情報",
    description: "日本国籍（外国籍情報なし）",
    employee: createBaseEmployee({
      isForeigner: false,
    }),
    targetField: null,
    expectedErrorCount: 0,
    expectedErrorCode: null,
  },

  // ========== 警備員資格情報のテスト ==========
  {
    id: 7,
    category: "警備員資格",
    description: "警備員登録あり + 登録日が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: null,
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: "dateOfSecurityGuardRegistration",
    expectedErrorCount: 1,
    expectedErrorCode: "SECURITY_GUARD_REGISTRATION_DATE_REQUIRED",
  },
  {
    id: 8,
    category: "警備員資格",
    description: "警備員登録あり + 血液型が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: null,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: "bloodType",
    expectedErrorCount: 1,
    expectedErrorCode: "BLOOD_TYPE_REQUIRED",
  },
  {
    id: 9,
    category: "警備員資格",
    description: "警備員登録あり + 緊急連絡先名が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: null,
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: "emergencyContactName",
    expectedErrorCount: 1,
    expectedErrorCode: "EMERGENCY_CONTACT_NAME_REQUIRED",
  },
  {
    id: 10,
    category: "警備員資格",
    description: "警備員登録あり + 緊急連絡先関係が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: null,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: "emergencyContactRelation",
    expectedErrorCount: 1,
    expectedErrorCode: "EMERGENCY_CONTACT_RELATION_REQUIRED",
  },
  {
    id: 11,
    category: "警備員資格",
    description: "警備員登録あり + 緊急連絡先関係詳細が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: null,
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: "emergencyContactRelationDetail",
    expectedErrorCount: 1,
    expectedErrorCode: "EMERGENCY_CONTACT_RELATION_DETAIL_REQUIRED",
  },
  {
    id: 12,
    category: "警備員資格",
    description: "警備員登録あり + 緊急連絡先住所が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: null,
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: "emergencyContactAddress",
    expectedErrorCount: 1,
    expectedErrorCode: "EMERGENCY_CONTACT_ADDRESS_REQUIRED",
  },
  {
    id: 13,
    category: "警備員資格",
    description: "警備員登録あり + 緊急連絡先電話番号が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: null,
      domicile: "東京都千代田区",
    }),
    targetField: "emergencyContactPhone",
    expectedErrorCount: 1,
    expectedErrorCode: "EMERGENCY_CONTACT_PHONE_REQUIRED",
  },
  {
    id: 14,
    category: "警備員資格",
    description: "警備員登録あり + 本籍地が null",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: null,
    }),
    targetField: "domicile",
    expectedErrorCount: 1,
    expectedErrorCode: "DOMICILE_REQUIRED",
  },
  {
    id: 15,
    category: "警備員資格",
    description: "警備員登録あり + すべて正常",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: true,
      dateOfSecurityGuardRegistration: new Date("2020-04-01"),
      bloodType: BLOOD_TYPE_VALUES.A.value,
      emergencyContactName: "山田花子",
      emergencyContactRelation: EMERGENCY_CONTACT_RELATION_VALUES.SPOUSE.value,
      emergencyContactRelationDetail: "配偶者",
      emergencyContactAddress: "東京都千代田区千代田1-1-1",
      emergencyContactPhone: "03-1234-5678",
      domicile: "東京都千代田区",
    }),
    targetField: null,
    expectedErrorCount: 0,
    expectedErrorCode: null,
  },
  {
    id: 16,
    category: "警備員資格",
    description: "警備員登録なし",
    employee: createBaseEmployee({
      hasSecurityGuardRegistration: false,
    }),
    targetField: null,
    expectedErrorCount: 0,
    expectedErrorCode: null,
  },
]);

// テスト結果
const testResults = computed(() => {
  return testCases.value.map((testCase) => {
    // beforeTest が定義されている場合は実行
    if (testCase.beforeTest) {
      testCase.beforeTest(testCase.employee);
    }

    const invalidReasons = testCase.employee.invalidReasons;

    // デバッグ: テスト1の詳細情報
    if (testCase.id === 1) {
      console.log("===== テスト1 デバッグ =====");
      console.log("employee.isForeigner:", testCase.employee.isForeigner);
      console.log("employee.foreignName:", testCase.employee.foreignName);
      console.log("employee.nationality:", testCase.employee.nationality);
      console.log(
        "employee.residenceStatus:",
        testCase.employee.residenceStatus,
      );
      console.log("全invalidReasons:", invalidReasons);
      console.log("全invalidReasons.length:", invalidReasons.length);

      // classPropsの確認
      console.log(
        "Employee.classProps.foreignName:",
        Employee.classProps.foreignName,
      );
      console.log(
        "Employee.classProps.foreignName.validator:",
        Employee.classProps.foreignName?.validator,
      );

      // validator直接実行
      if (Employee.classProps.foreignName?.validator) {
        const result = Employee.classProps.foreignName.validator(
          testCase.employee.foreignName,
          testCase.employee,
        );
        console.log("validator直接実行結果:", result);
      }
      console.log("========================");
    }

    // targetField が指定されている場合はそのフィールドのエラーのみをフィルタ
    const targetErrors = testCase.targetField
      ? invalidReasons.filter((error) => error.field === testCase.targetField)
      : [];

    const passed =
      targetErrors.length === testCase.expectedErrorCount &&
      (testCase.expectedErrorCode === null ||
        targetErrors.some(
          (error) => error.code === testCase.expectedErrorCode,
        ));

    return {
      ...testCase,
      actualErrors: targetErrors,
      allInvalidReasons: invalidReasons,
      passed,
    };
  });
});

const allPassed = computed(() => {
  return testResults.value.every((result) => result.passed);
});

// カテゴリー別の結果
const resultsByCategory = computed(() => {
  const categories = {};
  testResults.value.forEach((result) => {
    if (!categories[result.category]) {
      categories[result.category] = {
        total: 0,
        passed: 0,
        failed: 0,
      };
    }
    categories[result.category].total++;
    if (result.passed) {
      categories[result.category].passed++;
    } else {
      categories[result.category].failed++;
    }
  });
  return categories;
});
</script>

<template>
  <v-container fluid>
    <v-card>
      <v-card-title class="bg-primary">
        <v-icon start>mdi-flask</v-icon>
        Employee 国籍情報・警備員資格情報 Validator 検証
      </v-card-title>

      <v-card-text>
        <!-- 総合結果 -->
        <v-alert
          :type="allPassed ? 'success' : 'error'"
          :icon="allPassed ? 'mdi-check-circle' : 'mdi-alert-circle'"
          class="mb-4"
        >
          <div class="text-h6 mb-2">
            <strong
              >総合結果: {{ allPassed ? "すべて合格 ✓" : "一部失敗 ✗" }}</strong
            >
          </div>
          <div>合計: {{ testResults.length }} テスト</div>
          <div>
            合格: {{ testResults.filter((r) => r.passed).length }} / 失敗:
            {{ testResults.filter((r) => !r.passed).length }}
          </div>
        </v-alert>

        <!-- カテゴリー別集計 -->
        <v-row class="mb-4">
          <v-col
            v-for="(stats, category) in resultsByCategory"
            :key="category"
            cols="12"
            md="6"
          >
            <v-card
              :color="stats.failed === 0 ? 'success' : 'error'"
              variant="tonal"
            >
              <v-card-title class="text-subtitle-1">
                {{ category }}
              </v-card-title>
              <v-card-text>
                <div>合計: {{ stats.total }} テスト</div>
                <div>合格: {{ stats.passed }} / 失敗: {{ stats.failed }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- テストケース詳細 -->
        <v-expansion-panels>
          <v-expansion-panel v-for="result in testResults" :key="result.id">
            <v-expansion-panel-title>
              <v-row no-gutters align="center">
                <v-col cols="auto">
                  <v-icon
                    :icon="
                      result.passed ? 'mdi-check-circle' : 'mdi-close-circle'
                    "
                    :color="result.passed ? 'success' : 'error'"
                    class="mr-2"
                  />
                </v-col>
                <v-col>
                  <div class="text-subtitle-2">
                    [{{ result.category }}] テスト {{ result.id }}:
                    {{ result.description }}
                  </div>
                </v-col>
                <v-col cols="auto">
                  <v-chip
                    :color="result.passed ? 'success' : 'error'"
                    size="small"
                  >
                    {{ result.passed ? "合格" : "失敗" }}
                  </v-chip>
                </v-col>
              </v-row>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <v-card variant="outlined">
                <v-card-text>
                  <!-- 期待値 -->
                  <div class="mb-3">
                    <strong>期待値:</strong>
                    <ul class="text-caption">
                      <li v-if="result.targetField">
                        対象フィールド: {{ result.targetField }}
                      </li>
                      <li>エラー数: {{ result.expectedErrorCount }}</li>
                      <li v-if="result.expectedErrorCode">
                        エラーコード: {{ result.expectedErrorCode }}
                      </li>
                    </ul>
                  </div>

                  <v-divider class="my-2" />

                  <!-- 実際の結果 -->
                  <div class="mb-3">
                    <strong>実際の結果:</strong>
                    <ul class="text-caption">
                      <li v-if="result.targetField">
                        {{ result.targetField }} エラー数:
                        {{ result.actualErrors.length }}
                      </li>
                      <li>
                        全フィールドのエラー数:
                        {{ result.allInvalidReasons?.length || 0 }}
                      </li>
                      <li v-if="result.actualErrors.length > 0">
                        エラー詳細:
                        <ul>
                          <li
                            v-for="(error, index) in result.actualErrors"
                            :key="index"
                          >
                            <div>コード: {{ error.code }}</div>
                            <div>メッセージ: {{ error.message }}</div>
                            <div v-if="error.messages?.ja">
                              日本語: {{ error.messages.ja }}
                            </div>
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <!-- 全エラー (デバッグ用) -->
                  <div
                    v-if="
                      result.allInvalidReasons &&
                      result.allInvalidReasons.length > 0
                    "
                  >
                    <v-divider class="my-2" />
                    <div>
                      <strong>全エラー (デバッグ用):</strong>
                      <ul class="text-caption">
                        <li
                          v-for="(error, index) in result.allInvalidReasons"
                          :key="index"
                        >
                          フィールド: {{ error.field }} / コード:
                          {{ error.code }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
    </v-card>
  </v-container>
</template>
