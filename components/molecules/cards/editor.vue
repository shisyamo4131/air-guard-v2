<script setup>
/**
 * @file editor.vue
 * @description
 * コンテンツ編集用の再利用可能なカードコンポーネントです。
 * タイトルと閉じるボタンを持つツールバー、スロットによるコンテンツ領域、
 * そして確定ボタンを持つカードアクションを備えています。
 *
 * @component MoleculesCardsEditor
 *
 * @props {String} label - カードのツールバーに表示されるタイトル。デフォルトは undefined (タイトルなし) です。
 * @props {Boolean} disableSubmit - 確定ボタンを無効にするかどうか。デフォルトは false です。
 *
 * @emits click:close - ツールバーの閉じるボタンがクリックされたときに発行されます。
 * @emits click:submit - カードアクションの確定ボタンがクリックされたときに発行されます。
 *
 * @slots
 *   default - エディタカードの主要なコンテンツ領域。
 */
defineOptions({ inheritAttrs: false, name: "MoleculesCardsEditor" });
const props = defineProps({
  label: { type: String, default: undefined },
  disableSubmit: { type: Boolean, default: false },
});
const emit = defineEmits(["click:close", "click:submit"]);
</script>

<template>
  <v-card v-bind="$attrs">
    <v-toolbar>
      <v-toolbar-title>{{ label }}</v-toolbar-title>
      <v-spacer />
      <AtomsBtnsCloseIcon @click="emit('click:close')" />
    </v-toolbar>
    <v-card-text>
      <slot name="default" />
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <AtomsBtnsSubmit
        color="primary"
        :disabled="disableSubmit"
        variant="elevated"
        @click="emit('click:submit')"
      />
    </v-card-actions>
  </v-card>
</template>
