<script setup>
import { sendEmailVerification } from "firebase/auth";
import { useRouter } from "vue-router";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useAuthActions } from "@/composables/application/auth/useAuthActions";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";

definePageMeta({ layout: "auth" });

/*****************************************************************************
 * DEFINE STORES AND COMPOSABLES
 *****************************************************************************/
const errors = useErrorsStore();
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const router = useRouter();
const { $auth } = useNuxtApp();
const { setUser } = useAuthActions();
const { createAdminAccount, setupUserAccount } = useAuthFunctions();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
let intervalId = null;
let verificationCheckInProgress = false;

/*****************************************************************************
 * METHODS
 *****************************************************************************/
const handleSendEmailVerification = async () => {
  errors.clear();
  const key = loadings.add("メールを送信しています...");
  try {
    await sendEmailVerification($auth.currentUser);
    messages.add("認証メールを送信しました！");
  } catch (error) {
    errors.add(error);
  } finally {
    loadings.remove(key);
  }
};

/*****************************************************************************
 * LIFECYCLE HOOKS
 *****************************************************************************/
onMounted(() => {
  intervalId = setInterval(async () => {
    const currentUser = $auth.currentUser;
    if (!currentUser || verificationCheckInProgress) return;

    verificationCheckInProgress = true;

    try {
      await currentUser.reload();
      if (!currentUser.emailVerified) return;

      // email_verifiedを反映したtokenで本登録Callableを呼ぶ
      const idTokenResult = await currentUser.getIdTokenResult(true);
      const pendingAdminSetupKey =
        `airguard-v2:pending-admin-account-setup:${currentUser.uid}`;
      const pendingAdminSetupSource = localStorage.getItem(
        pendingAdminSetupKey,
      );

      if (!idTokenResult.claims?.companyId) {
        if (pendingAdminSetupSource) {
          let pendingAdminSetup;

          try {
            pendingAdminSetup = JSON.parse(pendingAdminSetupSource);
          } catch {
            throw new Error("管理者アカウントの登録情報を確認できません。");
          }

          if (
            !pendingAdminSetup ||
            typeof pendingAdminSetup !== "object" ||
            typeof pendingAdminSetup.companyName !== "string" ||
            !pendingAdminSetup.companyName.trim() ||
            typeof pendingAdminSetup.companyNameKana !== "string" ||
            !pendingAdminSetup.companyNameKana.trim() ||
            typeof pendingAdminSetup.displayName !== "string" ||
            !pendingAdminSetup.displayName.trim()
          ) {
            throw new Error("管理者アカウントの登録情報を確認できません。");
          }

          await createAdminAccount({
            companyName: pendingAdminSetup.companyName,
            companyNameKana: pendingAdminSetup.companyNameKana,
            displayName: pendingAdminSetup.displayName,
          });
          await currentUser.getIdToken(true);
          localStorage.removeItem(pendingAdminSetupKey);
        } else {
          await setupUserAccount();
        }
      } else if (pendingAdminSetupSource) {
        // Callable成功後に画面処理が中断された場合の一時情報を片付ける
        localStorage.removeItem(pendingAdminSetupKey);
      }

      // Callableで設定されたclaimを取得し、sessionを初期化する
      await setUser(currentUser);
      await router.replace("/dashboard");
    } catch (error) {
      errors.clear();
      errors.add(error);
    } finally {
      verificationCheckInProgress = false;
    }
  }, 3000); // 3秒ごとにチェック
});

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<template>
  <v-card flat max-width="480">
    <v-card-title>メールを確認してください</v-card-title>
    <v-card-subtitle class="text-wrap">
      入力されたメールアドレスへ認証メールをお送りしました。メール内のリンクをクリックして認証を完了してください。
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
    <v-card-text class="text-center">
      メール認証済みの場合
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
