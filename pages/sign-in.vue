<script setup>
import Base from "../schemas/Base";
const auth = useAuthStore();
const errors = useErrorsStore();
const email = ref("");
const password = ref("");

const BaseClass = new Base();

async function signIn() {
  await auth.signIn({
    email: email.value,
    password: password.value,
  });
}

async function signOut() {
  await auth.signOut();
}

async function createUser() {
  await auth.signUp(email.value, password.value);
}
</script>

<template>
  <v-container height="100%" class="bg-surface-variant">
    <v-row style="height: 100%" no-gutters justify="center">
      <v-col cols="6" align-self="center">
        <v-card>
          <v-card-title>Sign-In</v-card-title>
          <v-card-text>
            <v-text-field v-model="email" label="email" />
            <v-text-field v-model="password" label="password" />
          </v-card-text>
          <v-expand-transition>
            <v-card v-show="errors.hasError">
              <v-alert v-for="(error, index) in errors.list">{{
                error.message
              }}</v-alert>
            </v-card>
          </v-expand-transition>
          <v-card-actions>
            <v-btn @click="createUser">sign up</v-btn>
            <v-btn @click="signIn">sign in</v-btn>
            <v-btn @click="signOut">sign out</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
