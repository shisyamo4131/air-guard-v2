<script setup>
definePageMeta({ layout: "guest" });
const router = useRouter();

const navigateToSignIn = () => router.push("/auth/sign-in");
const navigateToSignUp = () => router.push("/auth/sign-up");
const navigateToSignUpAdmin = () => router.push("/auth/sign-up-admin");
</script>

<template>
  <v-container
    class="fill-height d-flex align-center justify-center bg-grey-lighten-4"
  >
    <v-row>
      <v-col cols="12" md="6" class="text-center text-md-left">
        <h1 class="text-h3 font-weight-bold mb-4">
          警備データの一元管理で、現場をもっとスマートに。
        </h1>
        <p class="mb-6">
          AirGuard
          は、警備業務に特化したデータ管理・スタッフ運用プラットフォームです。配備・勤怠・報告書まで、すべてをクラウドで。
        </p>
        <div class="d-flex flex-column ga-4">
          <v-card
            title="サインイン"
            prepend-icon="mdi-login"
            text="既にアカウントをお持ちの方はすぐにサインインして AirGuard の便利な機能を利用しましょう。"
          >
            <v-card-actions class="justify-end">
              <v-btn
                color="primary"
                class="mr-4"
                text="サインイン"
                variant="flat"
                @click="navigateToSignIn"
              />
            </v-card-actions>
          </v-card>
          <v-card
            title="サインアップ"
            prepend-icon="mdi-account-plus"
            text="既に AirGuard を利用中の会社様で、初めて AirGuard を利用する従業員の方はこちらからサインアップしてください。"
          >
            <v-card-actions class="justify-end">
              <v-btn
                color="primary"
                class="mr-4"
                text="サインアップ"
                variant="flat"
                @click="navigateToSignUp"
              />
            </v-card-actions>
          </v-card>
          <v-card
            title="管理者アカウント作成"
            prepend-icon="mdi-security"
            text="AirGuard のご利用を検討中の会社様は、こちらから管理者アカウントを作成してください。"
          >
            <v-card-actions class="justify-end">
              <v-btn
                color="primary"
                class="mr-4"
                text="管理者アカウント作成"
                variant="flat"
                @click="navigateToSignUpAdmin"
              />
            </v-card-actions>
          </v-card>
        </div>
      </v-col>

      <v-col cols="12" md="6">
        <div class="h-100 d-flex align-center">
          <v-img
            src="https://cdn-icons-png.flaticon.com/512/3144/3144456.png"
            alt="Security Illustration"
            height="300"
            contain
          />
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
h1 {
  line-height: 1.3;
}
</style>
