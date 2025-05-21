<script setup>
/**
 * 汎用的な送信・確定アクションを表すボタンコンポーネントです。
 * デフォルトでチェックアイコンが表示され、「確定」というテキストが表示されます。
 * テキストはスロットまたは `label` プロパティで、アイコンは `prependIcon` プロパティでカスタマイズ可能です。
 */
defineOptions({ inheritAttrs: false, name: "AtomsBtnsSubmit" });
const props = defineProps({
  /** ボタンのデフォルトテキスト。スロットが指定されていない場合に使用されます。 */
  label: { type: String, default: "確定" },
  /** ボタンの先頭に表示するアイコン。`null` を指定するとアイコンなしになります。 */
  prependIcon: { type: String, default: "mdi-check" },
});
</script>

<template>
  <v-btn v-bind="$attrs" :prepend-icon="props.prependIcon">
    <slot name="default">
      {{ label }}
    </slot>
  </v-btn>
</template>
