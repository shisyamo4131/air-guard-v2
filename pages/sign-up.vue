<script setup>
import Company from "../schemas/Company";
import User from "../schemas/User";

// const company = ref(new Company());
const company = ref(new Company({ name: "唯心", nameKana: "ユイシン" }));

const auth = useAuthStore();
// const email = ref("");
const email = ref("maruyama@yuisin.net");
// const password = ref("");
const password = ref("sevenstar");
const confirmPassword = ref("");
const errors = useErrorsStore();

async function createUser() {
  const userCredential = await auth.signUp(email.value, password.value);
  const companyDocRef = await company.value.create();
  const user = new User({ email: email.value, companyId: companyDocRef.id });
  await user.create();
}
</script>

<template>
  <v-container height="100%" class="bg-surface-variant">
    <v-row style="height: 100%" no-gutters justify="center">
      <v-col cols="6" lg="4" align-self="center">
        <v-card>
          <v-card-title>アカウント作成</v-card-title>
          <v-card-text>
            <v-text-field v-model="company.name" label="会社名" />
            <v-text-field v-model="company.nameKana" label="会社名カナ" />
            <v-text-field v-model="email" label="メールアドレス" />
            <v-text-field v-model="password" label="パスワード" />
            <v-text-field
              v-model="confirmPassword"
              label="パスワード（再入力）"
            />
          </v-card-text>
          <v-expand-transition>
            <v-card v-show="errors.hasError">
              <v-alert v-for="(error, index) in errors.list">{{
                error.message
              }}</v-alert>
            </v-card>
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
