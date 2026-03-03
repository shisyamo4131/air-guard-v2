<script setup>
/****************************************************************************
 * @file ./components/Agreement/Card/test.vue
 * @description AgreementCard テスト用コンポーネント
 *****************************************************************************/
import { computed } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();

const agreements = computed(() => auth.company?.agreements || []);
</script>

<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h5 mb-4">AgreementCard Test</h1>
      </v-col>
    </v-row>

    <v-row v-if="agreements.length">
      <v-col
        v-for="agreement in agreements"
        :key="agreement.docId || agreement.id || agreement.key"
        cols="12"
        md="6"
        lg="4"
      >
        <AgreementCard :agreement="agreement" />
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12">
        <v-alert type="info" variant="tonal">
          company.agreements に表示可能なデータがありません。
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>
