<script setup>
import { useGlobalLoading } from "@/composables/useGlobalLoading";

const {
  isLoading,
  primaryMessage,
  startLoading,
  stopLoading,
  setLoadingMessage,
  getLoadingKeys,
} = useGlobalLoading();

const simulateTask = async (
  key,
  message,
  duration = 2000,
  updateMessage = null
) => {
  startLoading(key, message);
  if (updateMessage) {
    setTimeout(() => setLoadingMessage(key, updateMessage), duration / 2);
  }
  await new Promise((resolve) => setTimeout(resolve, duration));
  stopLoading(key);
};
</script>

<template>
  <v-container class="pa-4" style="max-width: 600px">
    <div>{{ isLoading }}</div>
    <v-btn
      color="primary"
      class="mb-2"
      @click="simulateTask('task1', 'データを読み込んでいます...', 4000)"
    >
      タスク1開始
    </v-btn>

    <v-btn
      color="secondary"
      class="mb-2"
      @click="
        simulateTask(
          'task2',
          'ファイルをアップロード中...',
          5000,
          'アップロード中（残り半分）...'
        )
      "
    >
      タスク2開始（途中でメッセージ変更）
    </v-btn>

    <v-card class="pa-4 mt-4" outlined>
      <div class="text-subtitle-1 mb-2">ローディング状態:</div>
      <v-alert type="info" v-if="isLoading">
        現在ローディング中です（{{ getLoadingKeys().join(", ") }}）
        <br />
        表示メッセージ：{{ primaryMessage }}
      </v-alert>
      <v-alert type="success" v-else>
        現在ローディングされていません。
      </v-alert>
    </v-card>
  </v-container>
</template>
