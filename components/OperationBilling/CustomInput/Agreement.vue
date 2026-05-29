<script setup>
/*****************************************************************************
 * @file ./components/OperationBilling/CustomInput/Agreement.vue
 * @description 稼働請求ドキュメント 取極め・請求締日入力コンポーネント
 * - 取極めの選択と請求締日の入力を行います。
 * - 取極めが変更されると refreshBillingDateAt により請求締日が自動更新されます。
 * - 請求締日を手動で変更することも可能です。
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationBilling } from "@/schemas";
// COMPOSABLES
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  item: {
    type: Object,
    required: true,
    validator: (obj) => obj instanceof OperationBilling,
  },
});
const props = useDefaults(_props, "OperationBillingCustomInputAgreement");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchSiteComposable } = useFetch(
  "OperationBillingCustomInputAgreement",
);
const { cachedSites, fetchSite } = fetchSiteComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.item?.siteId,
  (siteId) => {
    if (siteId) fetchSite(siteId);
  },
  { immediate: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const agreements = computed(() => {
  const site = cachedSites.value?.[props.item.siteId];
  return site?.agreementsV2 || [];
});
</script>

<template>
  <div class="pt-2">
    <v-alert
      class="text-caption mb-2"
      color="info"
      icon="mdi-information"
      density="compact"
      text="取極めを選択すると請求締日が自動的に設定されます。請求締日を手動で変更することも可能です。"
    />
    <AgreementSelect
      v-bind="props.componentAttrs['agreement']"
      :items="agreements"
      clearable
      return-object
    />
    <air-date-input
      v-bind="props.componentAttrs['billingDateAt']"
      density="compact"
      variant="outlined"
    />
  </div>
</template>
