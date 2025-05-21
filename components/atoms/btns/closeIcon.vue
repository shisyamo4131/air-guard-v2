<script setup>
/**
 * @file AtomsBtnsCloseIcon.vue
 * @description
 * ツールバーなどで使用する、固定デザインの「閉じる」アイコンボタンです。
 * アイコンは "mdi-close" に固定されており、アクセシビリティのため "aria-label" が設定されています。
 */
defineOptions({ inheritAttrs: false, name: "AtomsBtnsCloseIcon" });
</script>

<template>
  <v-btn v-bind="$attrs" icon="mdi-close" aria-label="閉じる" />
</template>
