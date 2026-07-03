<script setup>
import { useAuthStore } from "@/stores/useAuthStore";
import { useRecentArrangements } from "@/composables/dataLayers/useRecentArrangements";
import { useSitesMustBeTerminated } from "@/composables/dataLayers/useSitesMustBeTerminated";

/*****************************************************************************
 * SETUP AUTH STORE
 *****************************************************************************/
const auth = useAuthStore();

/*****************************************************************************
 * SETUP ROUTER
 *****************************************************************************/
const router = useRouter();

/*****************************************************************************
 * SETUP DATA LAYER COMPOSABLES
 *****************************************************************************/
// RECENT ARRANGEMENT DOCUMENTS
const { docs: recentArrangements } = useRecentArrangements();
// SITES MUST BE TERMINATED
const { docs: sitesMustBeTerminated } = useSitesMustBeTerminated();
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
          <ChartsWeeklyOperationQuantityBar height="240" class="ma-4" />
        </MoleculesFloatingTitleCard>
      </v-col>
    </v-row>

    <v-row>
      <v-col>
        <MoleculesFloatingTitleCard
          color="error"
          prepend-icon="mdi-alert-circle-outline"
          title="工期終了現場"
        >
          <v-card-item>
            <v-card-subtitle class="text-wrap">
              次の現場は工期が終了しているようです。一定期間が経過すると自動的に稼働終了になります。
            </v-card-subtitle>
          </v-card-item>
          <SitesDataTable
            :items="sitesMustBeTerminated"
            hide-search
            @click:update="(item) => router.push(`/sites/${item.docId}`)"
          />
        </MoleculesFloatingTitleCard>
      </v-col>
    </v-row>
  </v-container>
</template>
