<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Activator/Agreement.vue
 * @description 稼働請求ドキュメントの取極め・請求締日表示コンポーネント
 * - `OperationBillingManager` の activator スロット用コンポーネント
 * - 設定されている取極め情報と請求締日を表示します。
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";
// COMPONENTS
import CustomInput from "@/components/OperationBilling/CustomInput/Agreement.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationBilling,
  },
});
const props = useDefaults(_props, "OperationBillingActivatorAgreement");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const agreementLabel = computed(() => {
  return props.item.agreement?.key ?? "取極めなし";
});
const billingDateLabel = computed(() => {
  return props.item.billingDate ?? "未設定";
});
const items = computed(() => [
  { title: "取極め", props: { subtitle: agreementLabel.value } },
  { title: "請求締日", props: { subtitle: billingDateLabel.value } },
]);

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({ customInput: CustomInput });
</script>

<template>
  <MoleculesActivatorCard class="d-flex flex-column">
    <!-- Toolbar Action を置換 -->
    <template #toolbar-action="slotProps">
      <v-btn v-bind="slotProps" icon="mdi-pencil" size="small" />
    </template>

    <!-- DEFAULT SLOT にコンテンツを配置 -->
    <template #default>
      <v-card-text class="py-0 d-flex flex-column">
        <air-list :items="items" fluid />
        <div class="flex-grow-1 d-flex align-end">
          <v-alert
            v-if="!props.item.isBillable"
            class="mb-4"
            density="compact"
            type="error"
            text="請求締日が未設定のため、請求データが作成されません。取極めの選択または手動入力で請求締日を設定してください。"
          />
        </div>
      </v-card-text>
      <v-card-actions v-if="$slots.actions">
        <slot name="actions" />
      </v-card-actions>
    </template>
  </MoleculesActivatorCard>
</template>
