<script setup>
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useStatisticsStore } from "@/stores/useStatisticsStore";

/** SETUP ROUTER */
const router = useRouter();

/** SETUP STORES */
const auth = useAuthStore();
const statistics = useStatisticsStore();
</script>

<template>
  <v-container class="py-8">
    <v-row v-if="auth.hasPermission('operation-billings:write')" dense>
      <v-col cols="12">
        <!-- 妥当性エラー稼働請求 -->
        <MoleculesPopupCardWithTitle color="warning">
          <template #title>
            <v-icon size="small">mdi-alert</v-icon>
            要修正稼働請求
          </template>
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
                  const site = statistics.cachedSites?.[item.siteId] || null;
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
            :items="statistics.invalidOperationBillings"
            :items-per-page="-1"
            hide-default-footer
            @click:row="
              (_, { item }) => {
                router.push(`/billings/operations/${item.docId}`);
              }
            "
          />
        </MoleculesPopupCardWithTitle>
      </v-col>
    </v-row>

    <!-- 概要カード -->
    <v-row class="mb-6" dense>
      <v-col cols="12" sm="4">
        <MoleculesPopupCardWithTitle>
          <template #title>
            <v-icon size="small">mdi-account-multiple</v-icon>
            本日の稼働数
          </template>
          <span class="text-h5">{{ statistics.operationCount }}</span>
          <span class="ml-2">稼働</span>
        </MoleculesPopupCardWithTitle>
      </v-col>
      <v-col cols="12" sm="4">
        <MoleculesPopupCardWithTitle color="secondary">
          <template #title>
            <v-icon size="small">mdi-pickaxe</v-icon>
            稼働中の現場
          </template>
          <span class="text-h5">{{ statistics.siteCount }}</span>
          <span class="ml-2">拠点</span>
        </MoleculesPopupCardWithTitle>
      </v-col>
    </v-row>
  </v-container>
</template>
