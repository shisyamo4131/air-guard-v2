<script setup>
/*****************************************************************************
 * @file ./components/organisms/ChangeAdminUser/WindowItem2.vue
 * @description `OrganismsChangeAdminUser` 専用コンポーネント
 * @inject selectedNewAdminUser - 新しい管理者ユーザーとして選択されたユーザー情報
 * @inject otherUsers - 管理者ユーザー以外のユーザー情報の配列
 *****************************************************************************/
import * as Vue from "vue";

/*****************************************************************************
 * INJECT
 *****************************************************************************/
const selectedNewAdminUser = Vue.inject("selectedNewAdminUser");
const otherUsers = Vue.inject("otherUsers");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
</script>

<template>
  <v-window-item :value="2">
    <v-card-text>
      新しい管理者ユーザーを選択してください。選択したユーザーは管理者権限を付与され、現在の管理者ユーザーは管理者権限を剥奪されます。
      <div class="mt-4">
        <v-chip-group v-model="selectedNewAdminUser" column>
          <v-chip
            v-for="user in otherUsers"
            :key="user.docId"
            :value="user"
            color="primary"
            filter
            :text="user.displayName"
          />
          <v-chip
            v-if="otherUsers.length === 0"
            color="error"
            text="管理者ユーザー以外のユーザーが見つかりません"
          />
        </v-chip-group>
      </div>
    </v-card-text>
  </v-window-item>
</template>
