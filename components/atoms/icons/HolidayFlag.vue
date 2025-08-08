<script setup>
/**
 * @file components/atoms/icons/HolidayFlag.vue
 * @description アイコンコンポーネント - 祝日フラグを表示
 */
const props = defineProps({
  color: { type: String, default: "red" },
});
</script>

<template>
  <v-icon :icon="`mdi-flag-variant`" :color="props.color" />
</template>
