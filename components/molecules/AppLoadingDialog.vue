<script setup>
/**
 * グローバルローディング状態を表示するためのダイアログコンポーネント。
 * アプリ全体で処理中の状態がある場合に表示される。
 * 表示・非表示やメッセージの管理は useGlobalLoading() によって制御される。
 */
import { useGlobalLoading } from "@/composables/useGlobalLoading";

// ローディング状態と、表示すべきメッセージを取得
const { isLoading, primaryMessage } = useGlobalLoading();
</script>

<template>
  <!-- グローバル処理中ダイアログ -->
  <v-dialog :model-value="isLoading" max-width="320" persistent>
    <v-list class="py-2" color="primary" elevation="12" rounded>
      <v-list-item>
        <!-- アイコン表示（左側） -->
        <template #prepend>
          <div class="pe-4">
            <v-icon color="primary" size="x-large">$vuetify-outline</v-icon>
          </div>
        </template>

        <!-- メッセージ表示エリア -->
        <v-list-item-title class="text-wrap">
          {{ primaryMessage || "処理中です。しばらくお待ちください。" }}
        </v-list-item-title>

        <!-- ローディングスピナー（右側） -->
        <template #append>
          <v-progress-circular
            color="primary"
            indeterminate="disable-shrink"
            size="16"
            width="2"
          />
        </template>
      </v-list-item>
    </v-list>
  </v-dialog>
</template>

<style scoped>
/* ダイアログが他の UI より上に来るように明示的に z-index を設定 */
.v-dialog {
  z-index: 3000;
}

/* メッセージの折り返し設定（長文対応） */
.v-list-item-title {
  white-space: normal;
  word-break: break-word;
}
</style>
