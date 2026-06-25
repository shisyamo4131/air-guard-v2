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
  <v-container>
    <!-- 従業員ユーザーであれば以下を表示 -->
    <!-- - 直近配置情報 -->
    <!-- - カレンダー -->
    <v-row v-if="auth.employeeId">
      <v-col cols="12" md="4">
        <ArrangementNotificationsManager :model-value="recentArrangements" />
      </v-col>
      <v-col cols="12" md="8">
        <air-calendar color="secondary" />
      </v-col>
    </v-row>

    <v-row v-if="auth.isAdmin && auth.isDeveloper">
      <v-col>
        <v-card class="overflow-visible">
          <v-chip
            color="secondary"
            label
            prepend-icon="mdi-chart-box-outline"
            text="稼働数の推移"
            variant="flat"
            size="x-large"
            style="position: absolute; top: -12px; left: 12px"
          />
          <v-card-text class="pt-10">
            <ChartsWeeklyOperationCountBar height="240" />
          </v-card-text>
        </v-card>
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
  </v-container>
</template>
