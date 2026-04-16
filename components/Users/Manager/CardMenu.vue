<script setup>
import { useDefaults } from "vuetify";

/*****************************************************************************
 * @file ./components/Users/Manager/CardMenu.vue
 * @description `UsersManager` 専用 `UserCard` メニューコンポーネント
 * - `auth` の有効化・無効化トリガーメニューコンポーネント。
 * - `UserCard` はループ生成されるため `UserCard` コンポーネントには内包させません。
 * - 上記と同じ理由で `activator` スロットを持ちません。`modelValue` プロパティで制御します。
 * - `props.user` が null の場合、メニューは無効化されます。
 * - `props.user` が `isAdmin` の場合、メニュー内のリストは無効化されます。
 *
 * @emits click:enable - 有効化アクションのクリックイベント（引数にユーザーオブジェクトを渡す）
 * @emits click:disable - 無効化アクションのクリックイベント（引数にユーザーオブジェクトを渡す）
 *****************************************************************************/

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  user: { type: Object, default: null }, // メニューの対象となるユーザーオブジェクト
});
const props = useDefaults(_props, "UserCardMenu");
const emit = defineEmits(["click:enable", "click:disable"]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const menuItems = computed(() => {
  if (props.user?.disabled) {
    return [{ title: "有効化", value: "click:enable" }]; // `auth` が無効な場合は「有効化」メニューのみ表示
  } else {
    return [{ title: "無効化", value: "click:disable" }]; // `auth` が有効な場合は「無効化」メニューのみ表示
  }
});
</script>

<template>
  <v-menu>
    <!-- LIST -->
    <!-- `props.user` が null または `isAdmin` の場合はリスト自体を無効化 -->
    <v-list
      class="py-0"
      :disabled="!props.user || props.user?.isAdmin"
      :items="menuItems"
      slim
      density="compact"
      @click:select="({ id }) => emit(id, props.user)"
    >
    </v-list>
  </v-menu>
</template>
