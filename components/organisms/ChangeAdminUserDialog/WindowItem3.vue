<script setup>
/*****************************************************************************
 * @file ./components/organisms/ChangeAdminUser/WindowItem3.vue
 * @description `OrganismsChangeAdminUser` 専用コンポーネント
 * @inject adminUser - 現在の管理者ユーザー情報
 * @inject selectedNewAdminUser - 新しい管理者ユーザーとして選択されたユーザー情報
 *****************************************************************************/
import * as Vue from "vue";

/*****************************************************************************
 * INJECT
 *****************************************************************************/
const adminUser = Vue.inject("adminUser");
const selectedNewAdminUser = Vue.inject("selectedNewAdminUser");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <v-window-item :value="3">
    <v-card-text>
      以下の内容で管理者ユーザーを変更してもよろしいですか？
      <v-alert type="warning" class="mt-4" density="compact">
        現在の管理者は権限が未設定の状態になります。
      </v-alert>
      <div class="mt-4">
        <div>
          <span>現在の管理者ユーザー: </span>
          <v-chip
            v-if="!!adminUser"
            color="primary"
            :text="adminUser.displayName"
          />
          <v-chip v-else color="error" text="管理者ユーザーが見つかりません" />
        </div>
        <div class="mt-2">
          <span>新しい管理者ユーザー: </span>
          <v-chip
            v-if="!!selectedNewAdminUser"
            color="primary"
            :text="selectedNewAdminUser.displayName"
          />
          <v-chip
            v-else
            color="error"
            text="新しい管理者ユーザーが選択されていません"
          />
        </div>
      </div>
    </v-card-text>
  </v-window-item>
</template>
