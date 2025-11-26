<script setup>
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useDataStore } from "@/stores/useDataStore";

/** SETUP ROUTER */
const router = useRouter();

/** SETUP STORES */
const dataStore = useDataStore();
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h4 font-weight-bold mb-6">ようこそ、AirGuardへ</h1>

    <v-row class="mb-6" dense>
      <v-col cols="12">
        <!-- 妥当性エラー稼働請求 -->
        <v-card border variant="flat">
          <v-card-title>修正が必要な稼働請求があります</v-card-title>
          <v-data-table
            :headers="[
              {
                title: '日付',
                key: 'dateAt',
                value: (item) =>
                  dayjs(item.dateAt).format('YYYY年MM月DD日(ddd)'),
              },
              {
                title: '現場名',
                key: 'siteId',
                value: (item) => {
                  const site = dataStore.cachedSites?.[item.siteId] || null;
                  return site ? site.name : 'loading...';
                },
              },
              {
                title: '内容',
                key: 'isInvalid',
                value: (item) => {
                  switch (item.isInvalid) {
                    case 'EMPTY_AGREEMENT':
                      return '取極めが未選択です。';
                    case 'EMPTY_BILLING_DATE':
                      return '請求締日が未設定です。';
                    default:
                      return '不明なエラーです。';
                  }
                },
              },
            ]"
            :items="dataStore.invalidOperationBillings"
            :items-per-page="-1"
            hide-default-footer
            @click:row="
              (_, { item }) => {
                router.push(`/billings/operations/${item.docId}`);
              }
            "
          />
        </v-card>
      </v-col>
    </v-row>

    <!-- 概要カード -->
    <v-row class="mb-6" dense>
      <v-col cols="12" sm="4">
        <v-card>
          <v-card-title>本日のシフト</v-card-title>
          <v-card-text class="text-h5">8 件</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card>
          <v-card-title>未確認の報告書</v-card-title>
          <v-card-text class="text-h5">3 件</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card>
          <v-card-title>稼働中の拠点</v-card-title>
          <v-card-text class="text-h5">5 拠点</v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- リンクボタン -->
    <v-row dense>
      <v-col cols="12" sm="4">
        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/employees')"
          >スタッフ管理</v-btn
        >
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/sites')"
          >現場一覧</v-btn
        >
      </v-col>
      <v-col cols="12" sm="4">
        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/reports')"
          >報告書</v-btn
        >
      </v-col>
    </v-row>
  </v-container>
</template>
