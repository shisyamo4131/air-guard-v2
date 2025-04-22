<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const errors = useErrorsStore();
const auth = useAuthStore();

const email = ref("");
const password = ref("");

const handleSignIn = async () => {
  errors.clear();
  try {
    await auth.signIn({ email: email.value, password: password.value });
    router.push("/dashboard");
  } catch (error) {
    // エラーロギングは singIn() で行われるため不要
  }
};

const goToSignUp = () => {
  router.push("/sign-up");
};
</script>

<template>
  <v-container height="100%" class="bg-surface-variant">
    <v-row style="height: 100%" no-gutters justify="center">
      <v-col align-self="center" class="d-flex justify-center">
        <v-form @submit.prevent="handleSignIn">
          <v-card width="320">
            <v-card-title>サインイン</v-card-title>
            <v-container>
              <v-row dense>
                <v-col cols="12">
                  <air-text-field
                    v-model="email"
                    label="email"
                    required
                    input-type="email"
                  />
                </v-col>
                <v-col cols="12">
                  <air-password v-model="password" label="password" required />
                </v-col>
              </v-row>
            </v-container>
            <v-expand-transition>
              <v-container v-if="errors.hasError">
                <v-alert
                  class="mb-2"
                  type="error"
                  v-for="(error, index) in errors.list"
                  density="comfortable"
                  :key="index"
                >
                  {{ error.message }}
                </v-alert>
              </v-container>
            </v-expand-transition>
            <v-card-actions>
              <v-btn block color="primary" variant="elevated" type="submit"
                >sign in</v-btn
              >
            </v-card-actions>
            <v-card-text class="text-center">
              アカウントをお持ちでないですか？
              <v-btn
                variant="text"
                color="primary"
                size="small"
                @click="goToSignUp"
              >
                サインアップ
              </v-btn>
            </v-card-text>
          </v-card>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>
