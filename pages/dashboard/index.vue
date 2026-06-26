<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
import { useRecentArrangements } from "@/composables/dataLayers/useRecentArrangements";

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
// RECENT ARRANGEMENT DOCUMENTS
const { docs: recentArrangements } = useRecentArrangements();

/** SETUP STORES */
const auth = useAuthStore();
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
        <!-- グラフ: 稼働数の推移 -->
        <MoleculesFloatingTitleCard
          color="secondary"
          prepend-icon="mdi-chart-box-outline"
          title="稼働数の推移"
        >
          <ChartsWeeklyOperationQuantityBar height="240" />
        </MoleculesFloatingTitleCard>
      </v-col>
    </v-row>
  </v-container>
</template>
