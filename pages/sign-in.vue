<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useLogger } from "@/composables/useLogger";

definePageMeta({ layout: "auth" });

/**
 * Authentication からスローされるエラーのリスト
 */
const AUTH_ERROR_CODE_MAP = {
  "auth/user-disabled": {
    status: "user-disabled",
    message: "このアカウントは無効化されています。",
  },
  "auth/user-not-found": {
    status: "user-not-found",
    message: "メールアドレス、パスワードをご確認ください。",
  },
  "auth/email-already-exists": {
    status: "already-exists",
    message: "このメールアドレスは既に使用されています。",
  },
  "auth/invalid-email": {
    status: "invalid-argument",
    message: "メールアドレスの形式が正しくありません。",
  },
  "auth/invalid-password": {
    status: "invalid-argument",
    message: "パスワードの形式が正しくありません。",
  },
  "auth/weak-password": {
    status: "invalid-argument",
    message: "パスワードが簡単すぎます（最低6文字以上にしてください）。",
  },
};

/*****************************************************************************
 * DEFINE STORES AND COMPOSABLES
 *****************************************************************************/
const auth = useAuthStore();
const logger = useLogger("sign-in", useErrorsStore());
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
  logger.clearError();
  const key = loadings.add("サインインしています...");
  try {
    await auth.signIn({ email: email.value, password: password.value });
    messages.add({ text: "サインインに成功しました！", color: "success" });
    router.push("/dashboard");
  } catch (error) {
    const mappedAuthError = AUTH_ERROR_CODE_MAP[error.code];
    if (mappedAuthError) {
      logger.error({ message: mappedAuthError.message });
    } else {
      logger.error({ error });
    }
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
