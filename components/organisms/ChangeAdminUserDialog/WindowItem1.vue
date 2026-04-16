<script setup>
/*****************************************************************************
 * @file ./components/organisms/ChangeAdminUser/WindowItem1.vue
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
/**
 * `VChip` に表示するテキストを返す。
 * - 管理者ユーザーが存在する場合はその表示名を、存在しない場合はエラーメッセージを返す。
 * @returns {string} 管理者ユーザーの表示名、またはエラーメッセージ
 */
const chipLabel = Vue.computed(() => {
  return adminUser.value
    ? adminUser.value.displayName
    : "管理者ユーザーが見つかりません";
});
</script>

<template>
  <v-window-item :value="1">
    <v-card-text>
      システムの管理者ユーザーを変更します。現在の管理者ユーザーは以下のとおりです。
      <div class="mt-4">
        <v-chip :color="!!adminUser ? 'primary' : 'error'" :text="chipLabel" />
      </div>
    </v-card-text>
  </v-window-item>
</template>
