<script setup>
import { ref, computed } from "vue";
import { Employee } from "@/schemas";

// Employee インスタンスを作成
const employee = ref(new Employee());

// バリデーションエラーを取得
const errors = computed(() => employee.value.invalidReasons);

// バリデーション状態
const isInvalid = computed(() => employee.value.isInvalid);

// エラー数
const errorCount = computed(() => errors.value.length);

// 現在のロケール
const locale = ref("ja");

// エラーメッセージを表示用に整形
const formattedErrors = computed(() => {
  return errors.value.map((error) => ({
    field: error.field,
    code: error.code,
    message: error.messages?.[locale.value] || error.message,
    originalMessage: error.message,
    hasJapanese: !!error.messages?.ja,
  }));
});

// 一部のフィールドを埋める
const fillSomeFields = () => {
  employee.value.lastName = "山田";
  employee.value.firstName = "太郎";
  employee.value.lastNameKana = "ヤマダ";
  employee.value.firstNameKana = "タロウ";
  employee.value.displayName = "山田 太郎";
};

// すべてのフィールドをリセット
const resetFields = () => {
  employee.value = new Employee();
};

// validate() を実行してエラーをキャッチ
const testValidate = () => {
  try {
    employee.value.validate();
    return { success: true, message: "バリデーション成功！" };
  } catch (error) {
    return {
      success: false,
      name: error.name,
      message: error.message,
      validationErrors: error.validationErrors,
    };
  }
};

const validateResult = ref(null);
const runValidate = () => {
  validateResult.value = testValidate();
};
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-container>
      <v-card class="mb-4">
        <v-card-title>invalidReasons テスト - Employee クラス</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  バリデーション状態
                </v-card-title>
                <v-card-text>
                  <v-chip
                    :color="isInvalid ? 'error' : 'success'"
                    label
                    class="mb-2"
                  >
                    {{ isInvalid ? "エラーあり" : "エラーなし" }}
                  </v-chip>
                  <div class="text-body-2">
                    エラー数: <strong>{{ errorCount }}</strong>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  テストアクション
                </v-card-title>
                <v-card-text>
                  <v-btn
                    @click="fillSomeFields"
                    color="primary"
                    variant="outlined"
                    block
                    class="mb-2"
                  >
                    一部フィールド入力
                  </v-btn>
                  <v-btn
                    @click="resetFields"
                    color="warning"
                    variant="outlined"
                    block
                    class="mb-2"
                  >
                    リセット
                  </v-btn>
                  <v-btn
                    @click="runValidate"
                    color="error"
                    variant="outlined"
                    block
                  >
                    validate() 実行
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  言語設定
                  <v-chip size="small" class="ml-2">{{ locale }}</v-chip>
                </v-card-title>
                <v-card-text>
                  <v-btn-toggle v-model="locale" mandatory>
                    <v-btn value="en">English</v-btn>
                    <v-btn value="ja">日本語</v-btn>
                  </v-btn-toggle>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- validate() 実行結果 -->
          <v-row v-if="validateResult">
            <v-col cols="12">
              <v-card
                :color="validateResult.success ? 'success' : 'error'"
                variant="tonal"
              >
                <v-card-title class="text-subtitle-1">
                  validate() 実行結果
                </v-card-title>
                <v-card-text>
                  <div class="text-body-2 mb-2">
                    <strong>Status:</strong>
                    {{ validateResult.success ? "成功" : "失敗" }}
                  </div>
                  <div v-if="!validateResult.success" class="text-body-2">
                    <div class="mb-1">
                      <strong>Error Name:</strong>
                      {{ validateResult.name }}
                    </div>
                    <div class="mb-2">
                      <strong>Error Message:</strong>
                    </div>
                    <pre class="text-caption">{{ validateResult.message }}</pre>
                    <div class="mt-2">
                      <strong>validationErrors:</strong>
                      {{ validateResult.validationErrors?.length || 0 }} 件
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- エラー一覧 -->
          <v-row>
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  invalidReasons 内容（{{ errorCount }} 件）
                </v-card-title>
                <v-card-text>
                  <v-table density="compact">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Code</th>
                        <th>Message ({{ locale }})</th>
                        <th>Original (en)</th>
                        <th>多言語</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(error, index) in formattedErrors"
                        :key="index"
                      >
                        <td>
                          <code class="text-caption">{{ error.field }}</code>
                        </td>
                        <td>
                          <v-chip size="x-small" label>{{ error.code }}</v-chip>
                        </td>
                        <td class="text-body-2">{{ error.message }}</td>
                        <td class="text-caption text-grey">
                          {{ error.originalMessage }}
                        </td>
                        <td>
                          <v-icon
                            :color="error.hasJapanese ? 'success' : 'grey'"
                            size="small"
                          >
                            {{
                              error.hasJapanese
                                ? "mdi-check-circle"
                                : "mdi-minus-circle"
                            }}
                          </v-icon>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- RAW データ表示 -->
          <v-row>
            <v-col cols="12">
              <v-expansion-panels>
                <v-expansion-panel>
                  <v-expansion-panel-title>
                    RAW データ (JSON)
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <pre class="text-caption">{{
                      JSON.stringify(errors, null, 2)
                    }}</pre>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-container>
  </TemplatesFixedHeightContainer>
</template>
