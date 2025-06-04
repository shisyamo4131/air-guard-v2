<script setup>
import { httpsCallable } from "firebase/functions";

const { $functions } = useNuxtApp();

async function test() {
  const callable = httpsCallable($functions, "testFunction");
  const res = await callable();
  console.log(res);
}
</script>

<template>
  <v-container>
    <v-btn @click="test">aaa</v-btn>
  </v-container>
</template>
