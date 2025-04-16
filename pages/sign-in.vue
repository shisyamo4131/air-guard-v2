<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

definePageMeta({ layout: "guest" });

const router = useRouter();
const errors = useErrorsStore();
const auth = useAuthStore();
const logger = useLogger();

const email = ref("");
const password = ref("");

const handleSignIn = async () => {
  try {
    await auth.signIn({ email: email.value, password: password.value });
    router.push("/dashboard");
  } catch (error) {
    logger.error({
      sender: "sign-in.vue",
      message: "サインインに失敗しました。",
      error,
    });
  }
};
</script>

<template>
  <v-container height="100%" class="bg-surface-variant">
    <v-row style="height: 100%" no-gutters justify="center">
      <v-col align-self="center" class="d-flex justify-center">
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
            <v-btn
              block
              color="primary"
              variant="elevated"
              @click="handleSignIn"
              >sign in</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
