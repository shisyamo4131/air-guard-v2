<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Input/Loss.vue
 * @description 加入保険喪失状態遷移用入力コンポーネント
 * - 現在の状態が `ENROLLED` の場合に、`LOSS` への状態遷移を行うための入力コンポーネント
 * @note `AirItemManager` の `customInput` として利用
 *****************************************************************************/
import { watch } from "vue";
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
const props = useDefaults(_props, "InsuranceTransitionInputLoss");

/*****************************************************************************
 * WATCH
 *****************************************************************************/
// isRetire が true の場合、lossReason を "退職" に設定
watch(
  () => props.item.isRetire,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      props.updateProperties({ lossReason: "退職" });
    }
  },
);
</script>

<template>
  <!-- 現在の状態: ENROLLED -->
  <!-- 喪失日、喪失理由が必要 -->
  <v-row v-if="props.item.status === STATUS.ENROLLED.value">
    <v-col cols="12">
      <v-alert type="info">
        保険喪失処理を行います。喪失日、喪失理由を入力してください。
      </v-alert>
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="componentAttrs['enrollmentDateAt']" disabled />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="componentAttrs['number']" disabled />
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="componentAttrs['lossDateAt']" required />
    </v-col>
    <v-col cols="12">
      <air-checkbox v-bind="componentAttrs['isRetire']" />
    </v-col>
    <v-col cols="12">
      <air-text-field
        v-bind="componentAttrs['lossReason']"
        :disabled="props.item.isRetire"
        required
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
