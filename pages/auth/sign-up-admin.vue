<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useCreateAdminUser } from "@/composables/useCreateAdminUser";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";

definePageMeta({ layout: "auth" });

/*****************************************************************************
 * DEFINE STORE AND COMPOSABLES
 *****************************************************************************/
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const router = useRouter();
const { signupAdmin } = useCreateAdminUser();
const { checkEmailAvailability } = useAuthFunctions();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive({
  email: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  companyNameKana: "",
  displayName: "",
});

const currentStep = ref(1); // 現在のステップを管理 (1-based)
const totalSteps = 3; // 合計ステップ数
const formValid = ref(false);
const loading = ref(false);
const emailChecked = ref(false); // メールアドレスチェック済みフラグ

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      // メールアドレスとパスワード
      return (
        model.email.trim() !== "" &&
        model.password === model.confirmPassword &&
        model.password.length >= 6
      );
    case 2:
      // 会社情報
      return (
        model.companyName.trim() !== "" && model.companyNameKana.trim() !== ""
      );
    case 3:
      // 管理者情報
      return model.displayName.trim() !== "";
    default:
      return false;
  }
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Handle the creation of a new admin user account.
 * - Uses the new auth-v2.js Cloud Functions.
 * - Creates Authentication account and Firestore documents.
 * - Sets custom claims and waits for token refresh.
 */
async function handleCreateUser() {
  errors.clear();
  loading.value = true;
  const key = loadings.add({ text: "管理者アカウントを作成しています" });

  try {
    // 新しいComposableを使用してアカウント作成
    // checkEmailAvailabilityは既にステップ1で実行済み
    await signupAdmin({
      email: model.email,
      password: model.password,
      companyName: model.companyName,
      companyNameKana: model.companyNameKana,
      displayName: model.displayName,
      skipEmailCheck: true, // メールアドレスチェックをスキップ
    });

    messages.add(
      "管理者アカウントの作成が完了しました。メール認証を完了してください。"
    );

    router.replace("/unconfirmedEmail");
  } catch (error) {
    console.error("Admin account creation error:", error);
    errors.add(error);
  } finally {
    loadings.remove(key);
    loading.value = false;
  }
}

/**
 * 次のステップへ進む
 * ステップ1からステップ2への遷移時にメールアドレスをチェック
 */
async function nextStep() {
  if (currentStep.value >= totalSteps) return;

  // ステップ1 → ステップ2への遷移時にメールアドレスをチェック
  if (currentStep.value === 1 && !emailChecked.value) {
    errors.clear();
    loading.value = true;
    const key = loadings.add({ text: "メールアドレスを確認しています" });

    try {
      await checkEmailAvailability({ email: model.email, isAdmin: true });
      emailChecked.value = true;
      currentStep.value++;
    } catch (error) {
      console.error("Email availability check error:", error);
      errors.add(error);
    } finally {
      loadings.remove(key);
      loading.value = false;
    }
  } else {
    // その他のステップ遷移
    currentStep.value++;
  }
}

/** Go to the previous step */
function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;

    // ステップ1に戻る場合、メールアドレスチェックフラグをリセット
    if (currentStep.value === 1) {
      emailChecked.value = false;
    }
  }
}
</script>

<template>
  <v-card :border="false" max-width="480">
    <v-card-title class="text-center text-h5 mb-4">アカウント作成</v-card-title>

    <v-form v-model="formValid">
      <v-stepper
        v-model="currentStep"
        hide-actions
        :items="['認証情報', '会社情報', '管理者情報']"
        flat
      >
        <!-- ステップ1: 認証情報 -->
        <template v-slot:item.1>
          <v-card :border="false">
            <v-row>
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
          </v-card>
        </template>

        <!-- ステップ2: 会社情報 -->
        <template v-slot:item.2>
          <v-card :border="false">
            <v-row>
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
          </v-card>
        </template>

        <!-- ステップ3: 管理者情報 -->
        <template v-slot:item.3>
          <v-card :border="false">
            <v-row>
              <v-col cols="12">
                <air-text-field
                  v-model="model.displayName"
                  label="管理者名"
                  required
                  :maxLength="40"
                />
              </v-col>
            </v-row>
          </v-card>
        </template>
      </v-stepper>

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

      <v-card-actions>
        <v-btn
          :disabled="currentStep === 1 || loading"
          variant="text"
          @click="prevStep"
        >
          戻る
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          v-if="currentStep < totalSteps"
          color="primary"
          :disabled="!isStepValid || loading"
          :loading="loading && currentStep === 1"
          variant="elevated"
          @click="nextStep"
        >
          次へ
        </v-btn>
        <v-btn
          v-else
          color="primary"
          type="submit"
          :disabled="!formValid || loading"
          :loading="loading"
          variant="elevated"
          @click="handleCreateUser"
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
        @click="router.push('/auth/sign-in')"
      >
        サインイン
      </v-btn>
    </v-card-text>
  </v-card>
</template>
