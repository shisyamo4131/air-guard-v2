<script setup>
/*****************************************************************************
 * @file ./components/Site/List/Customer.vue
 * @description 現場の取引先情報表示コンポーネント
 * @extends AirList
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Customer } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  customerId: { type: String, default: "" }, // 取引先ID
  customer: { type: Object, default: () => new Customer() },
  customerName: { type: String, default: "" }, // 取引先名（仮登録時のもの）
});
const props = useDefaults(_props, "SiteListCustomerInfo");

const items = computed(() => {
  return [
    { title: "取引先コード", props: { subtitle: props.customer?.code || "-" } },
    {
      title: "取引先名",
      props: { subtitle: props.customer?.name || props.customerName || "-" },
    },
  ];
});
</script>

<template>
  <air-list :items="items" />
</template>
