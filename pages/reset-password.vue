<script setup>
import { sendPasswordResetEmail } from "firebase/auth";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";

definePageMeta({ layout: "auth" });

/*****************************************************************************
 * DEFINE STORES AND COMPOSABLES
 *****************************************************************************/
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const router = useRouter();
const { $auth } = useNuxtApp();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const email = ref("");

/*****************************************************************************
 * METHODS
 *****************************************************************************/
const handleSendResetPasswordEmail = async () => {
  errors.clear();
  const key = loadings.add({
    message: "パスワードリセット用のメールを送信しています...",
  });
  try {
    await sendPasswordResetEmail($auth, email.value);
    messages.add("パスワードリセット用のメールを送信しました！");
  } catch (error) {
    errors.add(error);
  } finally {
    loadings.remove(key);
  }
};
</script>

<template>
  <v-card flat max-width="480">
    <v-card-title>パスワードをお忘れですか？</v-card-title>
    <v-card-subtitle class="text-wrap">
      登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
    </v-card-subtitle>
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
        @click="handleSendResetPasswordEmail"
        >メール送信</v-btn
      >
    </v-card-actions>
    <v-card-text class="text-center">
      <div>
        パスワードが分かる場合はこちら
        <v-btn
          variant="text"
          color="primary"
          size="small"
          @click="router.push('/sign-in')"
        >
          サインイン
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>
