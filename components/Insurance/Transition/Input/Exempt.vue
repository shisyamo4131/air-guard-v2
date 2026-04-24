<script setup>
/*****************************************************************************
 * @file ./components/Insurance/Transition/Input/Exempt.vue
 * @description 加入保険適用除外化状態遷移用入力コンポーネント
 * - `AirItemManager` の `customInput` として利用することを想定
 * - 現在の状態が `NOT_ENROLLED` または `ENROLLED` の場合に、`EXEMPT` への状態遷移を行うための入力コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { INSURANCE_STATUS_VALUES as STATUS } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: { type: Object, required: true }, // Insurance インスタンス（AirItemManager で複製されている）
  componentAttrs: { type: Object, default: () => ({}) }, // AirItemManager の スロットプロパティから提供されるコンポーネント属性
  updateProperties: { type: Function, required: true }, // AirItemManager の スロットプロパティから提供されるプロパティ更新関数
});
const props = useDefaults(_props, "InsuranceTransitionInputExempt");
</script>

<template>
  <!-- 現在の状態: NOT_ENROLLED -->
  <!-- 特別な入力項目不要で、サブミットアクションのみ -->
  <v-row v-if="props.item.status === STATUS.NOT_ENROLLED.value">
    <v-col cols="12">
      <v-alert type="info">
        「適用除外」に更新します。よろしいですか？
      </v-alert>
    </v-col>
  </v-row>
  <!-- 現在の状態: ENROLLED -->
  <!-- 喪失日、喪失理由が必要 -->
  <v-row v-else-if="props.item.status === STATUS.ENROLLED.value">
    <v-col cols="12">
      <v-alert type="info">
        同時に加入中保険の喪失処理を行います。喪失日、喪失理由を入力してください。
      </v-alert>
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="componentAttrs['enrollmentDateAt']" disabled />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="componentAttrs['number']" disabled />
    </v-col>
    <v-col cols="12">
      <air-date-input v-bind="componentAttrs['lossDateAt']" />
    </v-col>
    <v-col cols="12">
      <air-text-field v-bind="componentAttrs['lossReason']" />
    </v-col>
  </v-row>

  <!-- 現在の状態が遷移条件を満たしていない場合 -->
  <v-row v-else>
    <v-col cols="12">
      <v-alert type="error"> 現在の状態が遷移条件を満たしていません。 </v-alert>
    </v-col>
  </v-row>
</template>
