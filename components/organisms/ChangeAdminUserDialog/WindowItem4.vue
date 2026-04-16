<script setup>
/*****************************************************************************
 * @file ./components/organisms/ChangeAdminUser/WindowItem4.vue
 * @description `OrganismsChangeAdminUser` 専用コンポーネント
 * @inject adminUser - 現在の管理者ユーザー情報
 *****************************************************************************/
import * as Vue from "vue";

/*****************************************************************************
 * INJECT
 *****************************************************************************/
const adminUser = Vue.inject("adminUser");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <v-window-item :value="4">
    <v-card-text>
      管理者ユーザーを変更しました。現在の管理者ユーザーは以下のとおりです。
      <div class="mt-4">
        <v-chip
          v-if="!!adminUser"
          color="primary"
          :text="adminUser.displayName"
        />
        <v-chip v-else color="error" text="管理者ユーザーが見つかりません" />
      </div>
      <v-alert type="warning" class="mt-4" density="compact">
        旧管理者は権限が未設定の状態になっています。必要に応じて、ユーザー管理画面で権限を再設定してください。
      </v-alert>
    </v-card-text>
  </v-window-item>
</template>
