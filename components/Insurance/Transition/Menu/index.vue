<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Menu/index.vue
 * @description 保険状態遷移のアクション選択メニューコンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { INSURANCE_STATUS_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  insurance: { type: Object, required: true },
});
const props = useDefaults(_props, "InsuranceMenu");
const emit = defineEmits([
  "click:exempt",
  "click:enroll",
  "click:loss",
  "click:enrolled",
  "click:cancel",
  "click:rollback",
]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const menuItems = computed(() => {
  return [
    {
      title: "適用除外",
      value: "click:exempt",
      props: {
        prependIcon: "mdi-cancel",
        // EXEMPTへの遷移が可能かチェック
        disabled:
          props.insurance._canTransitionTo(
            INSURANCE_STATUS_VALUES.EXEMPT.value,
          ) !== true,
      },
    },
    {
      title: "加入",
      value: "click:enroll",
      props: {
        prependIcon: "mdi-account-plus",
        // ENROLLEDへの遷移が可能かチェック
        disabled:
          props.insurance._canTransitionTo(
            INSURANCE_STATUS_VALUES.ENROLLED.value,
          ) !== true,
      },
    },
    {
      title: "手続き完了",
      value: "click:enrolled",
      props: {
        prependIcon: "mdi-check-circle",
        disabled: !props.insurance.isProcessingEnrollment(),
      },
    },
    {
      title: "手続き取り下げ",
      value: "click:cancel",
      props: {
        prependIcon: "mdi-undo",
        disabled: !props.insurance.isProcessingEnrollment(),
      },
    },
    {
      title: "喪失",
      value: "click:loss",
      props: {
        prependIcon: "mdi-account-minus",
        // lossはENROLLED状態でのみ実行可能（状態遷移ではなくメソッド実行）
        disabled: !props.insurance.isEnrolled(),
      },
    },
    {
      title: "復元",
      value: "click:rollback",
      props: {
        prependIcon: "mdi-restore",
        disabled:
          props.insurance.history.length === 0 || props.insurance.isProcessing,
      },
    },
  ];
});
</script>

<template>
  <v-menu>
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
    <v-list
      class="py-0"
      :items="menuItems"
      slim
      density="compact"
      @click:select="({ id }) => emit(id, props.insurance)"
    >
      <template v-slot:prepend>
        <v-icon class="mr-n2" size="small"></v-icon>
      </template>
    </v-list>
  </v-menu>
</template>
