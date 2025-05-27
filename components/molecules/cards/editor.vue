<script setup>
/**
 * @file editor.vue
 * @description
 * コンテンツ編集用の再利用可能なカードコンポーネントです。
 * タイトルと閉じるボタンを持つツールバー、スロットによるコンテンツ領域、
 * そして確定ボタンを持つカードアクションを備えています。
 * default スロットは VForm にラップされており、isValid プロパティで検証結果を確認することができます。
 *
 * @component MoleculesCardsEditor
 *
 * @props {Boolean} disableSubmit - 確定ボタンを無効にするかどうか。デフォルトは false です。
 * @props {Boolean} isLoading - ローディングアニメーションを表示するかどうか。デフォルトは false です。
 * @props {Boolean} isValid - フォームのバリデーション結果。デフォルトは false（または null） です。
 * @props {String} label - カードのツールバーに表示されるタイトル。デフォルトは undefined (タイトルなし) です。
 *
 * @emits click:close - ツールバーの閉じるボタンがクリックされたときに発行されます。
 * @emits click:submit - カードアクションの確定ボタンがクリックされたときに発行されます。
 *
 * @slots
 *   default - エディタカードの主要なコンテンツ領域。
 */
import { useLogger } from "~/composables/useLogger";

defineOptions({ inheritAttrs: false, name: "MoleculesCardsEditor" });

// --- プロパティ定義 ---
const props = defineProps({
  disabled: { type: Boolean, default: false },
  disableSubmit: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  isValid: { type: Boolean, default: false },
  label: { type: String, default: undefined },
});

// --- イベント定義 ---
const emit = defineEmits(["click:close", "click:submit", "update:isValid"]);

// --- ストア / コンポーザブル
const logger = useLogger();

// --- VForm のバリデーション ---
// 更新されたら `update:isValid` イベントを emit
const isValid = ref(false);
watch(isValid, (newVal) => {
  emit("update:isValid", newVal);
});

/**
 * submit ボタンがクリックされた時の処理
 * - isValid が falsy の場合、エラーメッセージを出力して終了
 * - isValid が truthy の場合、`click:submit` イベントを emit
 */
function onClickSubmit() {
  if (!isValid.value) {
    logger.clearError;
    const error = new Error("入力に不備があります。");
    logger.error({
      sender: "MoleculesCardsEditor.vue",
      message: error.message,
      error,
    });
    return;
  }
  emit("click:submit");
}
</script>

<template>
  <v-card v-bind="$attrs">
    <v-toolbar>
      <v-toolbar-title>{{ label }}</v-toolbar-title>
      <v-spacer />
      <AtomsBtnsCloseIcon @click="emit('click:close')" />
    </v-toolbar>
    <v-card-text>
      <v-form v-model="isValid" :disabled="disabled">
        <slot name="default" v-bind="{ isValid }" />
      </v-form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <AtomsBtnsSubmit
        color="primary"
        :disabled="disableSubmit"
        :loading="isLoading"
        @click="onClickSubmit"
      />
    </v-card-actions>
  </v-card>
</template>
