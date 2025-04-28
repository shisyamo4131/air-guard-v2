<script setup>
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAsyncData } from "#app";
import { Company } from "air-guard-v2-schemas";

const route = useRoute();
const companyId = route.params.id;
const formValid = ref(false);
const company = ref(null);

const messages = useMessagesStore();

/**
 * Firestoreから会社データを取得します
 * Fetch company document from Firestore
 */
const { pending: loading, error } = await useAsyncData("company", async () => {
  try {
    const doc = await Company.fetchDoc({ id: companyId });
    company.value = doc;
  } catch (e) {
    messages.error("会社情報の取得に失敗しました");
    throw e;
  }
});

/**
 * Firestore上の会社情報を更新します
 * Update company document on Firestore
 */
async function updateCompany() {
  try {
    await company.value.update();
    messages.success("会社情報を更新しました");
  } catch (e) {
    console.error(e);
    messages.error("更新に失敗しました");
  }
}
</script>

<template>
  <v-container v-if="!loading">
    <v-form v-model="formValid" @submit.prevent="updateCompany">
      <air-text-field v-model="company.name" label="会社名" required />
      <air-text-field v-model="company.address" label="住所" />
      <air-text-field v-model="company.phone" label="電話番号" />
      <v-btn color="primary" type="submit" :disabled="!formValid"> 更新 </v-btn>
    </v-form>
  </v-container>
  <v-container v-else>
    <air-loading-dialog :model-value="['会社情報を取得中...']" />
  </v-container>
</template>
