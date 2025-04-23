<script setup>
import { ref, reactive } from "vue";

const errors = useErrorsStore();
const router = useRouter();
const auth = useAuthStore();

// フォーム入力モデル (テスト用の初期値を設定)
const model = reactive({
  companyName: "株式会社唯心",
  companyNameKana: "ユイシン",
  displayName: "丸山大三",
  email: "maruyama@yuisin.net",
  password: "sevenstar",
  confirmPassword: "sevenstar",
});

const currentStep = ref(1); // 現在のステップを管理 (1-based)
const totalSteps = 3; // 合計ステップ数

// フォーム全体のバリデーション状態 (v-formから自動で更新される)
const formValid = ref(false);

/**
 * 新規に管理者ユーザーアカウントを作成します。
 */
async function handleCreateUser() {
  if (!formValid.value) {
    console.warn("フォームが無効なため送信できません。");
    return;
  }
  errors.clear();
  try {
    const payload = { ...model };
    delete payload.confirmPassword;

    await auth.createUserWithCompany(payload);
    await auth.signIn({ email: model.email, password: model.password });
    await router.push("/dashboard");
  } catch (error) {
    console.error("アカウント作成またはサインインエラー:", error);
  }
}

// 次のステップへ
function nextStep() {
  // TODO: ステップ移動時のバリデーションが必要な場合は実装
  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

// 前のステップへ
function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

const goToSignIn = () => {
  router.push("/sign-in");
};
</script>

<template>
  <v-container fluid class="fill-height bg-surface-variant">
    <v-row align="center" justify="center" style="height: 100%">
      <v-col cols="11" sm="10" md="8" lg="6">
        <v-card class="pa-2 pa-md-4">
          <v-card-title class="text-center text-h5 mb-4"
            >アカウント作成</v-card-title
          >

          <v-form v-model="formValid" @submit.prevent="handleCreateUser">
            <v-stepper
              v-model="currentStep"
              :items="['会社情報', '管理者情報', '認証情報']"
              hide-actions
              flat
              bg-color="transparent"
              class="mb-4"
            >
              <!-- ステップコンテンツ -->
              <v-window v-model="currentStep">
                <v-window-item :value="1">
                  <v-container fluid>
                    <!-- 会社情報 -->
                    <v-row dense>
                      <v-col cols="12">
                        <air-text-field
                          v-model="model.companyName"
                          label="会社名"
                          required
                          :maxLength="40"
                        />
                      </v-col>
                      <v-col cols="12">
                        <air-text-field
                          v-model="model.companyNameKana"
                          label="会社名カナ"
                          required
                          :maxLength="40"
                          inputType="katakana"
                        />
                      </v-col>
                    </v-row>
                  </v-container>
                </v-window-item>

                <v-window-item :value="2">
                  <v-container fluid>
                    <!-- 管理者情報 -->
                    <v-row dense>
                      <v-col cols="12">
                        <air-text-field
                          v-model="model.displayName"
                          label="管理者名"
                          required
                          :maxLength="40"
                        />
                      </v-col>
                      <v-col cols="12">
                        <air-text-field
                          v-model="model.email"
                          label="メールアドレス"
                          required
                          inputType="email"
                        />
                      </v-col>
                    </v-row>
                  </v-container>
                </v-window-item>

                <v-window-item :value="3">
                  <v-container fluid>
                    <!-- 認証情報 -->
                    <v-row dense>
                      <v-col cols="12">
                        <air-password
                          v-model="model.password"
                          label="パスワード"
                          required
                        />
                      </v-col>
                      <v-col cols="12">
                        <air-password
                          v-model="model.confirmPassword"
                          label="パスワード（再入力）"
                          required
                          :password="model.password"
                        />
                      </v-col>
                    </v-row>
                  </v-container>
                </v-window-item>
              </v-window>
            </v-stepper>

            <!-- エラー表示 -->
            <v-expand-transition>
              <v-container v-if="errors.hasError" class="pt-0">
                <v-alert
                  type="error"
                  v-for="(error, index) in errors.list"
                  :key="error.code || index"
                  density="compact"
                  class="mb-2"
                  variant="tonal"
                >
                  {{ error.message }}
                </v-alert>
              </v-container>
            </v-expand-transition>

            <!-- ナビゲーションボタン -->
            <v-card-actions>
              <v-btn
                :disabled="currentStep === 1"
                @click="prevStep"
                variant="text"
              >
                戻る
              </v-btn>
              <v-spacer></v-spacer>
              <v-btn
                v-if="currentStep < totalSteps"
                color="primary"
                @click="nextStep"
                variant="elevated"
              >
                次へ
              </v-btn>
              <v-btn
                v-else
                color="primary"
                type="submit"
                :disabled="!formValid"
                variant="elevated"
              >
                アカウント作成
              </v-btn>
            </v-card-actions>
          </v-form>
          <v-card-text class="text-center">
            アカウントをお持ちの場合
            <v-btn
              variant="text"
              color="primary"
              size="small"
              @click="goToSignIn"
            >
              サインイン
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
