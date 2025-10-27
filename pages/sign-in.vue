<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";

definePageMeta({ layout: "auth" });

/*****************************************************************************
 * DEFINE STORES AND COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const router = useRouter();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const email = ref("");
const password = ref("");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
const handleSignIn = async () => {
  errors.clear();
  const key = loadings.add("サインインしています...");
  try {
    await auth.signIn({ email: email.value, password: password.value });
    router.push("/dashboard");
    messages.add({ text: "サインインに成功しました！", color: "success" });
  } catch (error) {
    errors.add(error);
  } finally {
    loadings.remove(key);
  }
};
</script>

<template>
  <v-card flat max-width="480">
    <v-form>
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
    </v-form>
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
      <v-btn
        block
        color="primary"
        variant="elevated"
        type="submit"
        @click="handleSignIn"
        >sign in</v-btn
      >
    </v-card-actions>
    <v-card-text class="text-center">
      <div>
        アカウントをお持ちでないですか？
        <v-btn
          variant="text"
          color="primary"
          size="small"
          @click="router.push('/sign-up')"
        >
          サインアップ
        </v-btn>
      </div>
      <div>
        パスワードをお忘れですか？
        <v-btn
          variant="text"
          color="primary"
          size="small"
          @click="router.push('/reset-password')"
        >
          パスワードリセット
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
