<!-- filepath: pages/auth/sign-up.vue -->
<script setup>
import { useRouter } from "vue-router";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useCreateNormalUser } from "@/composables/useCreateNormalUser";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";

definePageMeta({ layout: "auth" });

/*****************************************************************************
 * DEFINE STORE AND COMPOSABLES
 *****************************************************************************/
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const router = useRouter();
const { signupUser } = useCreateNormalUser();
const { checkUserPreRegistration, checkEmailAvailability } = useAuthFunctions();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive({
  email: "",
  password: "",
  confirmPassword: "",
});

const currentStep = ref(1); // 現在のステップを管理 (1-based)
const totalSteps = 2; // 合計ステップ数
const formValid = ref(false);
const loading = ref(false);
const preRegData = ref(null); // 事前登録データ
const emailChecked = ref(false); // メールアドレスチェック済みフラグ

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      // メールアドレス入力
      return model.email.trim() !== "";
    case 2:
      // パスワード入力
      return (
        model.password === model.confirmPassword && model.password.length >= 6
      );
    default:
      return false;
  }
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * 一般利用者アカウント作成処理
 */
async function handleCreateUser() {
  errors.clear();
  loading.value = true;
  const key = loadings.add({ text: "アカウントを作成しています" });

  try {
    // signupUserを実行（事前登録確認とメールアドレスチェックは既に完了）
    await signupUser({
      email: model.email,
      password: model.password,
    });

    messages.add(
      "アカウントの作成が完了しました。メール認証を完了してください。"
    );

    router.replace("/unconfirmedEmail");
  } catch (error) {
    console.error("User account creation error:", error);
    errors.add(error);
  } finally {
    loadings.remove(key);
    loading.value = false;
  }
}

/**
 * 次のステップへ進む
 * ステップ1 → ステップ2への遷移時に事前登録確認とメールアドレスチェック
 */
async function nextStep() {
  if (currentStep.value >= totalSteps) return;

  // ステップ1 → ステップ2への遷移時
  if (currentStep.value === 1 && !emailChecked.value) {
    errors.clear();
    loading.value = true;
    const key = loadings.add({ text: "メールアドレスを確認しています" });

    try {
      // 1. 事前登録確認
      const preReg = await checkUserPreRegistration({ email: model.email });

      if (!preReg.isPreRegistered) {
        throw new Error(
          "事前登録が見つかりません。\n管理者にお問い合わせください。"
        );
      }

      // 事前登録データを保存
      preRegData.value = preReg;

      // 2. メールアドレス重複チェック
      await checkEmailAvailability({ email: model.email, isAdmin: false });

      emailChecked.value = true;
      currentStep.value++;

      messages.add(
        `${preReg.displayName || "利用者"}様の事前登録を確認しました。`
      );
    } catch (error) {
      console.error("Email check error:", error);
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

/** 前のステップに戻る */
function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;

    // ステップ1に戻る場合、フラグをリセット
    if (currentStep.value === 1) {
      emailChecked.value = false;
      preRegData.value = null;
    }
  }
}
</script>

<template>
  <v-card flat max-width="480">
    <v-card-title class="text-center text-h5 mb-4">
      アカウント登録
    </v-card-title>

    <v-card-subtitle v-if="preRegData" class="text-center mb-4">
      <v-chip color="primary" variant="tonal">
        {{ preRegData.displayName || "利用者" }}
      </v-chip>
      として登録します
    </v-card-subtitle>

    <v-form v-model="formValid">
      <v-stepper
        v-model="currentStep"
        hide-actions
        :items="['メールアドレス', 'パスワード']"
        flat
      >
        <!-- ステップ1: メールアドレス -->
        <template v-slot:item.1>
          <v-card flat>
            <v-card-text class="text-body-2 mb-4">
              管理者により事前登録されたメールアドレスを入力してください。
            </v-card-text>
            <v-row>
              <v-col cols="12">
                <air-text-field
                  v-model="model.email"
                  label="メールアドレス"
                  required
                  inputType="email"
                  :disabled="emailChecked"
                />
              </v-col>
            </v-row>
          </v-card>
        </template>

        <!-- ステップ2: パスワード -->
        <template v-slot:item.2>
          <v-card flat>
            <v-card-text class="text-body-2 mb-4">
              使用するパスワードを設定してください（6文字以上）。
            </v-card-text>
            <v-row>
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
      <div class="mb-2">
        管理者としてアカウントを作成する場合は
        <v-btn
          variant="text"
          color="primary"
          size="small"
          @click="router.push('/auth/sign-up-admin')"
        >
          こちら
        </v-btn>
      </div>
      <div>
        アカウントをお持ちの場合
        <v-btn
          variant="text"
          color="primary"
          size="small"
          @click="router.push('/auth/sign-in')"
        >
          サインイン
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
