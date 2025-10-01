<script setup>
import { useDisplay } from "vuetify";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useLoadingsStore } from "@/stores/useLoadingsStore";

const { smAndDown } = useDisplay();

// メッセージストアとローディングキュー
const messages = useMessagesStore();
const { queue } = useLoadingsStore();
</script>

<template>
  <v-app>
    <!-- グローバルローディング状態を表示するダイアログ -->
    <air-loading-dialog :model-value="queue" />

    <v-snackbar-queue v-model="messages.queue"></v-snackbar-queue>

    <!-- メインコンテンツ表示領域 -->
    <v-main>
      <v-container fluid class="pa-0 fill-height">
        <v-row style="height: 100%">
          <v-col
            v-if="!smAndDown"
            cols="12"
            md="7"
            lg="8"
            xl="9"
            class="fill-height d-flex flex-column justify-center bg-grey-lighten-4"
          >
            <div class="align-self-center pa-4">
              <h1 class="text-h3 font-weight-bold mb-4">
                警備データの一元管理で、<br />
                現場をもっとスマートに。
              </h1>
              <p class="mb-6">
                AirGuard は、警備業務に特化した<br />
                データ管理・スタッフ運用プラットフォームです<br />
                配備・勤怠・報告書まで、すべてをクラウドで
              </p>
            </div>
          </v-col>
          <v-col
            cols="12"
            md="5"
            lg="4"
            xl="3"
            class="fill-height d-flex flex-column"
          >
            <div class="d-flex align-center pa-2">
              <v-icon class="mr-2" color="grey-darken-2" size="small"
                >mdi-shield-check</v-icon
              >
              <span class="font-weight-bold text-grey-darken-2 text-subtitle-1"
                >Air Guard</span
              >
            </div>
            <div class="pa-4 d-flex align-center justify-center flex-grow-1">
              <NuxtPage />
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style>
.firebase-emulator-warning {
  display: none;
}

/* CSS カスタムプロパティの定義 */
:root {
  --app-bar-height: 64px; /* VAppBar の高さ */
  --footer-height: 40px; /* VFooter の高さ */
}
</style>
