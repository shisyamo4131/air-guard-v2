<script setup>
/*****************************************************************************
 * @file ./components/organisms/ChangeAdminUserDialog/index.vue
 * @description 管理者ユーザーを変更するためのダイアログコンポーネント
 * - ログインユーザーが管理者でない場合 (auth.isAdmin !== true) 、このコンポーネントは使用できません。
 *
 * @emit complete - 管理者変更処理が完了し、ダイアログが閉じられたときに発火するイベント
 *****************************************************************************/
import { User } from "@/schemas";
import * as Vue from "vue";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useMessagesStore } from "@/stores/useMessagesStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useLogger } from "../composables/useLogger";
import { useAuthFunctions } from "@/composables/auth/useAuthFunctions";
import WindowItem1 from "./WindowItem1.vue";
import WindowItem2 from "./WindowItem2.vue";
import WindowItem3 from "./WindowItem3.vue";
import WindowItem4 from "./WindowItem4.vue";

/*****************************************************************************
 * DEFINE EMITS
 *****************************************************************************/
const emit = defineEmits(["complete"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const loadings = useLoadingsStore();
const messages = useMessagesStore();
const auth = useAuthStore();
const logger = useLogger();
const { changeAdminUser } = useAuthFunctions();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const dialog = Vue.ref(false); // ダイアログの開閉状態
const userInstance = Vue.reactive(new User()); // User インスタンス
const step = Vue.ref(1); // 現在のステップ
const isLoading = Vue.ref(false); // 管理者変更処理のローディング状態
const selectedNewAdminUser = Vue.ref(null); // 新しい管理者ユーザーとして選択されたユーザー情報

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
Vue.watch(
  dialog,
  (newVal) => {
    if (newVal) {
      subscribe();
    } else {
      step.value = 1;
      selectedNewAdminUser.value = null;
      unsubscribe();
    }
  },
  { immediate: true },
);
/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * 現在の管理者ユーザーを返す。
 * - ユーザードキュメントの中から `isAdmin` フィールドが `true` のドキュメントを検索し、
 *   見つかった場合はそのドキュメントを返す。見つからない場合は `null` を返す。
 * @returns {Object|null} 管理者ユーザーのドキュメント、または見つからない場合は `null`
 */
const adminUser = Vue.computed(() => {
  return userInstance.docs.find((doc) => doc.isAdmin);
});

/**
 * 管理者ユーザー以外のユーザーの配列を返す。
 * - ユーザードキュメントの中から `isAdmin` フィールドが `false` のドキュメントをフィルタリングし、その配列を返す。
 * @returns {Array} 管理者ユーザー以外のユーザードキュメントの配列
 */
const otherUsers = Vue.computed(() => {
  return userInstance.docs.filter((doc) => !doc.isAdmin);
});

/**
 * 次へボタン（確定ボタン）の有効/無効を判定する。
 * - 現在のステップに応じて、必要な条件を満たしているかをチェックする。
 *   - ステップ1: 管理者ユーザーが存在すること
 *   - ステップ2: 新しい管理者ユーザーが選択されていること
 *   - それ以外: 常に有効
 */
const enableToNextStep = Vue.computed(() => {
  if (step.value === 1) {
    return !!adminUser.value;
  } else if (step.value === 2) {
    return !!selectedNewAdminUser.value;
  } else {
    return true;
  }
});

/**
 * 左側のボタンを表示するかどうかを判定する。
 * - ステップが4未満の場合は表示する。それ以外の場合は表示しない。
 * @returns {boolean} 左側のボタンを表示する場合は `true`、表示しない場合は `false`
 */
const showLeftBtn = Vue.computed(() => {
  return step.value < 4;
});

/**
 * 左側のボタンの属性を返す。
 * - ボタンのテキストとクリックハンドラーを、ログインユーザーの管理者権限の有無と現在のステップに応じて動的に設定する。
 *  - 管理者でないユーザー、またはステップ1の場合: テキストは「キャンセル」、クリックハンドラーはダイアログを閉じる関数
 *  - それ以外の場合: テキストは「戻る」、クリックハンドラーはステップを戻る関数
 * @returns {Object} ボタンのテキストとクリックハンドラーを含むオブジェクト
 */
const leftBtnAttrs = Vue.computed(() => {
  const text = step.value === 1 ? "キャンセル" : "戻る";
  const handler =
    step.value === 1 ? () => (dialog.value = false) : () => step.value--;
  return {
    disabled: isLoading.value,
    text,
    onClick: handler,
    variant: "flat",
  };
});

/**
 * アクションボタンの属性を返す。
 * - ボタンのテキストとクリックハンドラーを、現在のステップに応じて動的に設定する。
 *   - ステップ1: テキストは「次へ」、クリックハンドラーはステップを進める関数
 *   - ステップ2: テキストは「次へ」、クリックハンドラーはステップを進める関数
 *   - ステップ3: テキストは「実行」、クリックハンドラーは管理者変更処理を実行する関数
 *   - ステップ4: テキストは「終了」、クリックハンドラーはダイアログを閉じる関数
 * @returns {Object} ボタンのテキストとクリックハンドラーを含むオブジェクト
 */
const rightBtnAttrs = Vue.computed(() => {
  const text = step.value < 3 ? "次へ" : step.value === 3 ? "実行" : "終了";
  const handler =
    step.value < 3
      ? () => step.value++
      : step.value === 3
        ? handleChangeAdminUser
        : () => {
            dialog.value = false;
            emit("complete");
          };
  return {
    text,
    onClick: handler,
    color: "primary",
    disabled: isLoading.value || !enableToNextStep.value,
    loading: isLoading.value,
    variant: "flat",
  };
});

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
/**
 * ユーザードキュメントの購読を開始する。
 * - `userInstance` の `subscribeDocs` メソッドを呼び出して、ユーザードキュメントの購読を開始する。
 * - 購読の際には、`disabled` フィールドが `false`、かつ `isTemporary` フィールドが `false` のドキュメントのみを対象とするように制約を指定する。
 * - これにより、無効化されたユーザーや一時的なユーザーは管理者変更の対象から除外される。
 * @returns {void}
 */
function subscribe() {
  userInstance.subscribeDocs({
    constraints: [
      ["where", "disabled", "==", false],
      ["where", "isTemporary", "==", false],
    ],
  });
}

/**
 * ユーザードキュメントの購読を停止する。
 * - `userInstance` の `unsubscribe` メソッドを呼び出して、ユーザードキュメントの購読を停止する。
 * @returns {void}
 */
function unsubscribe() {
  userInstance.unsubscribe();
}

/**
 * 管理者ユーザーを変更する。
 * @returns {Promise<void>}
 */
async function handleChangeAdminUser() {
  const key = loadings.add("管理者権限を移譲しています...");
  try {
    isLoading.value = true;
    await changeAdminUser({
      from: adminUser.value.docId,
      to: selectedNewAdminUser.value.docId,
    });
    step.value = 4;
    messages.add("管理者権限の移譲に成功しました！");
  } catch (error) {
    logger.error({ error });
  } finally {
    isLoading.value = false;
    loadings.remove(key);
  }
}

/*****************************************************************************
 * PROVIDES
 *****************************************************************************/
Vue.provide("adminUser", adminUser);
Vue.provide("selectedNewAdminUser", selectedNewAdminUser);
Vue.provide("otherUsers", otherUsers);
</script>

<template>
  <v-dialog v-model="dialog" max-width="600" persistent>
    <template #activator="slotProps">
      <!-- SLOT: ACTIVATOR -->
      <!-- props プロパティに `disabled` を追加して提供 -->
      <slot
        name="activator"
        v-bind="{
          ...slotProps,
          props: { ...slotProps.props, disabled: !auth.isAdmin },
        }"
      >
        <v-btn
          v-bind="slotProps.props"
          :disabled="!auth.isAdmin"
          text="管理者変更"
        />
      </slot>
    </template>
    <v-card border="false">
      <v-toolbar color="primary" density="compact" title="管理者変更" />
      <v-window v-model="step">
        <!-- 現在管理者確認ウィンドウ -->
        <WindowItem1 />
        <!-- 新管理者選択ウィンドウ -->
        <WindowItem2 />
        <!-- 確認ウィンドウ -->
        <WindowItem3 />
        <!-- 完了ウィンドウ -->
        <WindowItem4 />
      </v-window>
      <v-card-actions>
        <v-btn v-if="showLeftBtn" v-bind="leftBtnAttrs" />
        <v-spacer />
        <v-btn v-bind="rightBtnAttrs" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
