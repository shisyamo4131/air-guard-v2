<script setup>
const { createUserWithCompany } = useCreateUser();
const logger = useLogger();
const errors = useErrorsStore();

const name = ref("唯心");
const nameKana = ref("ユイシン");
const displayName = ref("丸山");
const email = ref("maruyama@yuisin.net");
const password = ref("sevenstar");
const confirmPassword = ref("");

async function createUser() {
  errors.clear();
  try {
    const res = await createUserWithCompany({
      email: email.value,
      password: password.value,
      companyName: name.value,
      companyNameKana: nameKana.value,
      displayName: displayName.value,
    });
  } catch (error) {
    logger.error({ sender: "sign-up.vue", message: error.message, error });
  }
}
</script>

<template>
  <v-container height="100%" class="bg-surface-variant">
    <v-row style="height: 100%" no-gutters justify="center">
      <v-col cols="6" lg="4" align-self="center">
        <v-card>
          <v-card-title>アカウント作成</v-card-title>
          <v-card-text>
            <v-text-field v-model="name" label="会社名" />
            <v-text-field v-model="nameKana" label="会社名カナ" />
            <v-text-field v-model="displayName" label="管理者名" />
            <v-text-field v-model="email" label="メールアドレス" />
            <v-text-field v-model="password" label="パスワード" />
            <v-text-field
              v-model="confirmPassword"
              label="パスワード（再入力）"
            />
          </v-card-text>
          <v-expand-transition>
            <v-container v-show="errors.hasError">
              <v-alert
                type="error"
                v-for="error in errors.list"
                density="comfortable"
              >
                {{ error.message }}
              </v-alert>
            </v-container>
          </v-expand-transition>
          <v-card-actions>
            <v-btn block color="primary" variant="elevated" @click="createUser"
              >sign up</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
