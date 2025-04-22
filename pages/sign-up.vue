<script setup>
// ログ・エラー・ルーティング・認証状態の各ストア
const errors = useErrorsStore();
const router = useRouter();
const auth = useAuthStore();

// フォーム入力モデル
const model = reactive({
  companyName: "株式会社唯心",
  companyNameKana: "ユイシン",
  displayName: "丸山大三",
  email: "maruyama@yuisin.net",
  password: "sevenstar",
  confirmPassword: "sevenstar",
});

const formValid = ref(false);

/**
 * 新規に管理者ユーザーアカウントを作成します。
 * Create a new admin account and sign in.
 */
async function handleCreateUser() {
  errors.clear();
  try {
    await auth.createUserWithCompany(model); // 処理中ローダーは内部で自動表示
    await auth.signIn(model);
    await router.push("/dashboard");
  } catch (error) {
    // エラーロギングは try ブロック内の関数で行われるため不要
  }
}
</script>

<template>
  <v-container height="100%" class="bg-surface-variant">
    <v-row style="height: 100%" no-gutters justify="center">
      <v-col cols="6" lg="4" align-self="center">
        <v-card>
          <v-card-title>アカウント作成</v-card-title>
          <v-form v-model="formValid">
            <v-container>
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
            <v-expand-transition>
              <v-container v-show="errors.hasError">
                <v-alert
                  type="error"
                  v-for="error in errors.list"
                  :key="error.message"
                  density="comfortable"
                >
                  {{ error.message }}
                </v-alert>
              </v-container>
            </v-expand-transition>
            <v-card-actions>
              <v-btn
                block
                color="primary"
                @click="handleCreateUser"
                :disabled="!formValid"
              >
                sign up
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
