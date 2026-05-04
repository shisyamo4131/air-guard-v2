<script setup>
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { useStatisticsStore } from "@/stores/useStatisticsStore";
import { useRecentArrangements } from "@/composables/dataLayers/useRecentArrangements";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// RECENT ARRANGEMENT DOCUMENTS
const { docs: recentArrangements } = useRecentArrangements();

/** SETUP ROUTER */
const router = useRouter();

/** SETUP STORES */
const auth = useAuthStore();
const statistics = useStatisticsStore();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <!-- 従業員ユーザーであれば直近の配置通知情報を表示 -->
    <v-row v-if="auth.employeeId && auth.isAdmin">
      <v-col cols="12">
        <ArrangementNotificationsManager :model-value="recentArrangements" />
      </v-col>
    </v-row>
    <!-- 概要カード -->
    <!-- <v-row class="mb-6" dense>
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
    </v-row> -->
  </TemplatesFixedHeightContainer>
</template>
