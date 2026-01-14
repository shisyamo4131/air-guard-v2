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
  <v-container>
    <v-row v-if="auth.hasPermission('operation-billings:write')" dense>
      <v-col cols="12">
        <!-- 妥当性エラー稼働請求 -->
        <air-card color="warning" prepend-icon="mdi-alert" popup>
          <template #title> 要修正稼働請求 </template>
          <template #subtitle> 修正・確認が必要な稼働請求です。 </template>
          <template #text>
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
          </template>
        </air-card>
      </v-col>
    </v-row>

    <!-- 概要カード -->
    <v-row class="mb-6" dense>
      <v-col cols="12" sm="4">
        <air-card color="primary" prepend-icon="mdi-account-multiple" popup>
          <template #title> 本日の稼働数 </template>
          <template #text>
            <span class="text-h5">{{ statistics.operationCount }}</span>
            <span class="ml-2">稼働</span>
          </template>
        </air-card>
      </v-col>
      <v-col cols="12" sm="4">
        <air-card color="secondary" prepend-icon="mdi-pickaxe" popup>
          <template #title> 稼働中の現場 </template>
          <template #text>
            <span class="text-h5">{{ statistics.siteCount }}</span>
            <span class="ml-2">拠点</span>
            <span>（うち仮登録 </span>
            <nuxt-link to="/sites" class="text-decoration-none">
              <span class="text-primary cursor-pointer">
                {{ statistics.temporarySiteCount }}
              </span>
            </nuxt-link>
            <span> 件）</span>
          </template>
        </air-card>
      </v-col>
    </v-row>
  </v-container>
</template>
