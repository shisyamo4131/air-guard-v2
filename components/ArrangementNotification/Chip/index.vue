<script setup>
/*****************************************************************************
 * ArrangementNotificationChip
 * @file components/ArrangementNotification/chip/index.vue
 * @description 配置通知ステータスを表示するためのチップコンポーネントです。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";

/*****************************************************************************
 * SETUP PROPS
 *****************************************************************************/
const _props = defineProps({
  /**
   * ラベル表示にするかどうか（既定値: true）
   */
  label: { type: Boolean, default: true },
  /**
   * チップのサイズ（既定値: 'x-small'）
   */
  size: { type: String, default: "x-small" },
  /**
   * 配置通知オブジェクト
   */
  notification: {
    type: Object,
    default: undefined,
    validator: (v) => {
      return !v || v instanceof ArrangementNotification;
    },
  },
});
const props = useDefaults(_props, "ArrangementNotificationChip");

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
// 仮配置ステータス（props.notification が指定されていない場合に使用）
const temporaryNotificationAttrs = {
  value: "TEMPORARY",
  title: "仮配置",
  order: 0,
  color: undefined,
};

// コンポーネントに適用する属性
const attrs = computed(() => {
  const resolvedAttrs = props.notification
    ? ArrangementNotification.STATUS[props.notification.status]
    : temporaryNotificationAttrs;
  return {
    ...resolvedAttrs,
    label: props.label,
    text: resolvedAttrs.title,
    size: props.size,
  };
});
</script>

<template>
  <v-chip v-bind="attrs" />
</template>
