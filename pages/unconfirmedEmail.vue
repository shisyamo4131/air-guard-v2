<script setup>
import { sendEmailVerification } from "firebase/auth";
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

/*****************************************************************************
 * METHODS
 *****************************************************************************/
const handleSendEmailVerification = async () => {
  errors.clear();
  const key = loadings.add({
    message: "メールを送信しています...",
  });
  try {
    await sendEmailVerification($auth.currentUser);
    messages.add({
      text: "認証メールを送信しました！",
      color: "success",
    });
  } catch (error) {
    errors.add(error);
  } finally {
    loadings.remove(key);
  }
};
</script>

<template>
  <v-card flat max-width="480">
    <v-card-title>メールを確認してください</v-card-title>
    <v-card-subtitle class="text-wrap">
      メールアドレスの認証が完了していません。登録したメールアドレスに認証メールを送信しましたので、メール内のリンクをクリックして認証を完了してください。
    </v-card-subtitle>
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
        @click="handleSendEmailVerification"
        >メール再送信</v-btn
      >
    </v-card-actions>
  </v-card>
</template>
