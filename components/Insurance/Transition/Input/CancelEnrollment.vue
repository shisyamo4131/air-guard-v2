<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Input/CancelEnrollment.vue
 * @description 加入保険加入手続きキャンセル用入力コンポーネント
 * - 現在の状態が `ENROLLED` かつ `isProcessing === true` の場合に、状態を
 *   1 つ前の状態に戻すための入力コンポーネント
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
const props = useDefaults(_props, "InsuranceTransitionInputCancelEnrollment");
</script>

<template>
  <!-- 現在の状態: ENROLLED && isProcessing === true -->
  <!-- 加入手続きキャンセルのための入力が必要 -->
  <v-row
    v-if="
      props.item.status === STATUS.ENROLLED.value && props.item.isProcessing
    "
  >
    <v-col cols="12">
      <v-alert type="info"> 保険加入手続きキャンセル処理を行います。 </v-alert>
    </v-col>
  </v-row>

  <!-- 現在の状態が遷移条件を満たしていない場合 -->
  <v-row v-else>
    <v-col cols="12">
      <v-alert type="error"> 現在の状態が遷移条件を満たしていません。 </v-alert>
    </v-col>
  </v-row>
</template>
