<script setup>
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAsyncData } from "#app";
import { Company } from "air-guard-v2-schemas";

const route = useRoute();
const companyId = route.params.id;
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
</script>

<template>
  <v-container v-if="!loading">
    <v-card>
      <v-card-title>会社情報</v-card-title>
      <v-card-text>
        <v-list dense>
          <v-list-item>
            <v-list-item-title>会社名</v-list-item-title>
            <v-list-item-subtitle>{{ company.name }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>住所</v-list-item-title>
            <v-list-item-subtitle>{{ company.address }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>電話番号</v-list-item-title>
            <v-list-item-subtitle>{{ company.phone }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-container>

  <v-container v-else>
    <air-loading-dialog :model-value="['会社情報を取得中...']" />
  </v-container>
</template>
