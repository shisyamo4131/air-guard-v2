<script setup>
const { createUserWithCompany } = useCreateUser();
const logger = useLogger();
const errors = useErrorsStore();
const loading = ref(false);
const router = useRouter();
const auth = useAuthStore();

const name = ref("");
const nameKana = ref("");
const displayName = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");

const formValid = ref(false);

async function createUser() {
  errors.clear();
  loading.value = true;
  try {
    await createUserWithCompany({
      email: email.value,
      password: password.value,
      companyName: name.value,
      companyNameKana: nameKana.value,
      displayName: displayName.value,
    });
    await auth.signIn({ email: email.value, password: password.value });
    await router.push("/dashboard");
  } catch (error) {
    logger.error({ sender: "sign-up.vue", message: error.message, error });
  } finally {
    loading.value = false;
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
                    v-model="name"
                    label="会社名"
                    required
                    :maxLength="40"
                  />
                </v-col>
                <v-col cols="12">
                  <air-text-field
                    v-model="nameKana"
                    label="会社名カナ"
                    required
                    :maxLength="40"
                    inputType="katakana"
                  />
                </v-col>
                <v-col cols="12">
                  <air-text-field
                    v-model="displayName"
                    label="管理者名"
                    required
                    :maxLength="40"
                  />
                </v-col>
                <v-col cols="12">
                  <air-text-field
                    v-model="email"
                    label="メールアドレス"
                    required
                    inputType="email"
                  />
                </v-col>
                <v-col cols="12">
                  <air-password
                    v-model="password"
                    label="パスワード"
                    required
                  />
                </v-col>
                <v-col cols="12">
                  <air-password
                    v-model="confirmPassword"
                    label="パスワード（再入力）"
                    required
                    :password="password"
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
                @click="createUser"
                :loading="loading"
                :disabled="!formValid"
              >
                sign up
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
    <MoleculesDialogsLoader
      v-model="loading"
      message="管理者ユーザーアカウントを作成しています"
    ></MoleculesDialogsLoader>
  </v-container>
</template>
