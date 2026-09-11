<script setup>
/*****************************************************************************
 * @file components/Site/CustomInput/Customer.vue
 * @description 現場の取引先変更用カスタム入力コンポーネント
 *****************************************************************************/
const props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  item: { type: Object, required: true },
});

const originalCustomerId = computed(() => {
  const beforeData = props.item._beforeData;
  return beforeData && Object.hasOwn(beforeData, "customerId")
    ? beforeData.customerId
    : props.item.customerId;
});
</script>

<template>
  <CustomerAutocomplete
    v-bind="props.componentAttrs['customerId']"
    :clearable="!originalCustomerId"
  />
  <v-alert
    v-if="originalCustomerId"
    type="info"
    variant="tonal"
    density="compact"
  >
    設定済みの取引先を未設定へ戻すことはできません。
  </v-alert>
</template>
