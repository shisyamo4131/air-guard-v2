<script setup>
const router = useRouter();

const navigateToSignIn = () => router.push("/sign-in");
const navigateToSignUp = () => router.push("/sign-up");
</script>

<template>
  <v-container
    class="fill-height d-flex align-center justify-center bg-grey-lighten-4"
  >
    <v-row>
      <v-col cols="12" md="6" class="text-center text-md-left">
        <h1 class="text-h3 font-weight-bold mb-4">
          警備データの一元管理で、<br />
          現場をもっとスマートに。
        </h1>
        <p class="mb-6">
          AirGuard は、警備業務に特化した<br />
          データ管理・スタッフ運用プラットフォームです。<br />
          配備・勤怠・報告書まで、すべてをクラウドで。
        </p>
        <v-btn color="primary" class="mr-4" large @click="navigateToSignIn">
          サインイン
        </v-btn>
        <v-btn outlined color="primary" large @click="navigateToSignUp">
          サインアップ
        </v-btn>
      </v-col>

      <v-col cols="12" md="6">
        <v-img
          src="https://cdn-icons-png.flaticon.com/512/3144/3144456.png"
          alt="Security Illustration"
          height="300"
          contain
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
h1 {
  line-height: 1.3;
}
</style>
