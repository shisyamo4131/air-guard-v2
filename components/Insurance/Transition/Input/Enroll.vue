<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Input/Enroll.vue
 * @description 加入保険適用状態遷移用入力コンポーネント
 * - 現在の状態が `NOT_ENROLLED` または `EXEMPT` の場合に、`ENROLLED` への状態遷移を行うための入力コンポーネント
 * @note `AirItemManager` の `customInput` として利用
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { INSURANCE_STATUS_VALUES as STATUS } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // Insurance インスタンス
  componentAttrs: { type: Object, default: () => ({}) }, // AirItemManager の スロットプロパティから提供されるコンポーネント属性
  updateProperties: { type: Function, required: true }, // AirItemManager の スロットプロパティから提供されるプロパティ更新関数
});
const props = useDefaults(_props, "InsuranceTransitionInputEnroll");

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * 加入手続き中フラグ（isProcessing）が true に更新された場合、被保険者番号（整理記号）を null に更新しておく
 * - これにより、加入手続き中の状態で被保険者番号が残ることを防止する
 * - isProcessing が true から false に更新された場合は、被保険者番号は null のままにしておく（加入手続きキャンセルの状態を維持する）
 */
watch(
  () => props.item.isProcessing,
  (newVal, oldVal) => {
    // false → true になった場合のみ
    if (newVal && !oldVal) {
      props.updateProperties({ number: null });
    }
  },
);
</script>

<template>
  <!-- 現在の状態: NOT_ENROLLED || EXEMPT -->
  <!-- 資格取得日、被保険者番号（整理記号）が必要 -->
  <v-row
    v-if="
      props.item.status === STATUS.NOT_ENROLLED.value ||
      props.item.status === STATUS.EXEMPT.value
    "
  >
    <v-col cols="12">
      <v-alert type="info">
        保険加入処理を行います。資格取得日、被保険者番号（整理記号）を入力してください。
      </v-alert>
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="componentAttrs['enrollmentDateAt']" required />
    </v-col>
    <v-col cols="12">
      <air-checkbox v-bind="componentAttrs['isProcessing']" />
    </v-col>
    <v-col cols="12">
      <air-text-field
        v-bind="componentAttrs['number']"
        :disabled="componentAttrs['isProcessing'].modelValue"
        :required="!componentAttrs['isProcessing'].modelValue"
      />
    </v-col>
  </v-row>

  <!-- 現在の状態が遷移条件を満たしていない場合 -->
  <v-row v-else>
    <v-col cols="12">
      <v-alert type="error"> 現在の状態が遷移条件を満たしていません。 </v-alert>
    </v-col>
  </v-row>
</template>
