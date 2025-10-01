<script setup>
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";

/*****************************************************************************
 * DEFINE STORE AND COMPOSABLES
 *****************************************************************************/
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const router = useRouter();
const auth = useAuthStore();
const { $auth, $firestore } = useNuxtApp();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const model = reactive({
  companyName: "",
  companyNameKana: "",
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
});

const currentStep = ref(1); // 現在のステップを管理 (1-based)
const totalSteps = 3; // 合計ステップ数
const formValid = ref(false);
const loading = ref(false);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * Wait for custom claims to be set on the user.
 * - This function is for waiting until the `companyId` is set in the custom claims and reflected in the ID token.
 * - It repeatedly refreshes the ID token and checks for the presence of the specified custom claim.
 * - If the claim is found within the timeout period, it resolves successfully.
 * - If the timeout is reached without finding the claim, it throws an error.
 * @param user {import("firebase/auth").User} The user to check.
 * @param timeout {number} The maximum time to wait in milliseconds.
 * @returns {Promise<boolean>} Resolves to true if the claim is found, otherwise throws an error.
 * @throws {Error} If the timeout is reached without the claim being set.
 */
async function waitForCompanyIdIsSet(user, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const idTokenResult = await user.getIdTokenResult(true);
    if (idTokenResult.claims["companyId"]) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("カスタムクレームの反映にタイムアウトしました");
}

/**
 * Create a new admin user account of the company.
 * This function creates a user with email and password,
 * then creates a `admin_users` document to trigger a Cloud Function
 * that sets up the user's custom claims and create the company and user document.
 * Note: Require to wait for the custom claims to be set and reflected in the ID token.
 * @returns {Promise<void>} Resolves when the user is created and custom claims are set.
 * @throws {Error} If there is an error during the process.
 */
function createAdminUser() {
  let unsubscribe = null;
  return new Promise(async (resolve, reject) => {
    try {
      const userCredential = await auth.signUp(model);
      const uid = userCredential.user.uid;
      const docRef = doc($firestore, `admin_users/${uid}`);
      await setDoc(docRef, {
        companyName: model.companyName,
        companyNameKana: model.companyNameKana,
        displayName: model.displayName,
        email: model.email,
        createdAt: new Date(),
      });
      unsubscribe = onSnapshot(docRef, async (snapshot) => {
        if (!snapshot.exists()) {
          await waitForCompanyIdIsSet(userCredential.user);
          await auth.setUser($auth.currentUser);
          unsubscribe();
          resolve();
        }
      });
    } catch (error) {
      if (unsubscribe) unsubscribe();
      reject(error);
    }
  });
}

/**
 * Handle the creation of a new admin user account.
 */
async function handleCreateUser() {
  errors.clear();
  loading.value = true;
  const key = loadings.add({ text: "管理者アカウントを作成しています" });
  try {
    await createAdminUser();
    messages.add({
      text: "管理者アカウントの作成が完了しました。",
      color: "success",
    });
    router.push("/dashboard");
  } catch (error) {
    errors.add(error);
  } finally {
    loadings.remove(key);
    loading.value = false;
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

          <v-form v-model="formValid">
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
                @click="nextStep"
                variant="elevated"
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
