<script setup>
/*****************************************************************************
 * @file components/Site/CustomInput/index.vue
 * @description 取引先が未登録でも現場を作成できる3ステップ入力
 *****************************************************************************/
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";

const props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  item: { type: Object, required: true },
  step: { type: Number, default: 1 },
  updateProperties: { type: Function, required: true },
});

const { searchCustomers } = useFetchCustomer();
const searchResults = ref([]);
const step1 = ref(null);
const step3 = ref(null);

async function handleGoToNext({ step, item }) {
  if (step === 1) {
    searchResults.value = [];
    const { valid } = await step1.value.validate();
    if (!valid) return false;
    searchResults.value = await searchCustomers(item.customerName, {
      returnAllCached: false,
    });
  }

  if (step === 3) {
    const { valid } = await step3.value.validate();
    if (!valid) return false;
  }
}

defineExpose({
  mode: "step",
  steps: 3,
  handleGoToNext,
});
</script>

<template>
  <v-window :model-value="props.step">
    <v-window-item :value="1">
      <v-form ref="step1" class="pt-2" @submit.prevent>
        <air-text-field
          v-bind="props.componentAttrs['customerName']"
          clearable
          hint="取引先名を入力（一部でも可）"
          persistent-hint
          required
        />
      </v-form>
    </v-window-item>

    <v-window-item :value="2">
      <div v-if="searchResults.length">
        <v-alert
          class="mb-2"
          type="info"
          density="compact"
          :text="`${searchResults.length} 件の取引先が見つかりました`"
        />
        <CustomersIterator
          v-bind="props.componentAttrs['customerId']"
          :customers="searchResults"
          show-select
          select-strategy="single"
        />
        <v-alert class="mt-2" type="info" density="compact" variant="tonal">
          該当する取引先がない場合は、選択せずに「次へ」をクリックしてください。
        </v-alert>
      </div>
      <v-banner
        v-else
        class="mb-2"
        color="info"
        icon="mdi-information-symbol"
        density="compact"
        text="指定された条件に該当する取引先は見つかりませんでした。このまま取引先未設定で現場を登録する場合は「次へ」をクリックしてください。"
      />
    </v-window-item>

    <v-window-item :value="3">
      <v-form ref="step3" class="pt-2">
        <v-row dense>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['code']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['name']" />
          </v-col>
          <v-col cols="12">
            <air-checkbox v-bind="props.componentAttrs['hasAbbreviation']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['abbreviation']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['nameKana']" />
          </v-col>
          <v-col cols="12">
            <SitePostalCodeInput
              v-bind="props.componentAttrs['zipcode']"
              :item="props.item"
              :update-properties="props.updateProperties"
              :disabled="props.disabled"
            />
          </v-col>
          <v-col cols="12">
            <air-select v-bind="props.componentAttrs['prefCode']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['city']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['address']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['building']" />
          </v-col>
          <v-col cols="12">
            <air-select v-bind="props.componentAttrs['securityType']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="props.componentAttrs['siteNumber']" />
          </v-col>
          <v-col cols="12" md="6">
            <air-date-input
              v-bind="props.componentAttrs['constructionPeriodStartAt']"
            />
          </v-col>
          <v-col cols="12" md="6">
            <air-date-input
              v-bind="props.componentAttrs['constructionPeriodEndAt']"
            />
          </v-col>
          <v-col cols="12">
            <air-textarea v-bind="props.componentAttrs['remarks']" />
          </v-col>
        </v-row>
      </v-form>
    </v-window-item>
  </v-window>
</template>
