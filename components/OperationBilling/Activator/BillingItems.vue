<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/Activator/BillingItems.vue
 * @description 稼働請求ドキュメントの請求内訳表示コンポーネント
 * - `OperationBillingManager` の activator スロット用コンポーネント
 *****************************************************************************/
import CustomInput from "@/components/OperationBilling/CustomInput/Adjust.vue";

defineOptions({
  name: "OperationBillingActivatorBillingItems",
  inheritAttrs: false,
});

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({ customInput: CustomInput });
</script>

<template>
  <MoleculesActivatorCard v-bind="$attrs" no-padding>
    <!-- Toolbar Action を置換 -->
    <template #toolbar-action="slotProps">
      <v-btn
        v-bind="slotProps"
        append-icon="mdi-pencil"
        text="数量・単価を調整"
      />
    </template>

    <!-- DEFAULT SLOT にコンテンツを配置 -->
    <template #default="{ item }">
      <OperationBillingTableBillingDetail :item="item" />
    </template>
  </MoleculesActivatorCard>
</template>
