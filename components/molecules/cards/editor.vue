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
import { ref, watch } from "vue";

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

// --- テンプレート参照 ---
const form = ref(null); // v-form への参照

// --- VForm のバリデーション ---
// 更新されたら `update:isValid` イベントを emit
const formIsValid = ref(false); // v-form の v-model 用
watch(formIsValid, (newVal) => {
  emit("update:isValid", newVal);
});

/**
 * submit ボタンがクリックされた時の処理
 * - v-form の validate() を実行
 * - バリデーション結果が無効な場合、エラーメッセージを出力して終了
 * - バリデーション結果が有効な場合、`click:submit` イベントを emit
 */
async function onClickSubmit() {
  if (!form.value) {
    // 通常は発生しませんが、フォーム参照がない場合のガード
    return;
  }
  const { valid } = await form.value.validate();
  if (!valid) {
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
      <v-form ref="form" v-model="formIsValid" :disabled="disabled">
        <slot name="default" v-bind="{ isValid: formIsValid }" />
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
