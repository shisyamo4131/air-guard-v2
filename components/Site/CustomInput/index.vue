<script setup>
/*****************************************************************************
 * @file ./components/Site/CustomInput/index.vue
 * @description A input component to regist `Site`.
 *****************************************************************************/
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  step: { type: Number, default: 1 },
});
const props = useDefaults(_props, "SiteCustomInput");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const fetchCustomerComposable = useFetchCustomer();
const { searchCustomers } = fetchCustomerComposable;

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
// ステップ1で入力された取引先名での検索結果を格納する配列
const searchResults = ref([]);

// 各ステップの VForm の参照
const step1 = ref(null);
const step2 = ref(null); // 取引先選択なので現在未使用
const step3 = ref(null);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * 次へ進むボタンのハンドラ
 * @param options.step 現在のステップ番号
 * @param options.item 現在のステップでの入力値オブジェクト
 */
async function handleGoToNext({ step, item }) {
  switch (step) {
    case 1: {
      // ステップ1の処理

      // 検索結果をクリア
      searchResults.value = [];

      // 入力内容の検証
      const { valid } = await step1.value.validate();
      if (!valid) return false;

      // 入力された取引先名で検索を実行
      searchResults.value = await searchCustomers(item.customerName, {
        returnAllCached: false,
      });

      return;
    }
    case 2: {
      // ステップ2の処理
      return;
    }
    case 3: {
      // 最終ステップの処理

      // 入力内容の検証
      const { valid } = await step3.value.validate();
      if (!valid) return false;
      return;
    }
  }
}

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({
  mode: "step",
  steps: 3,
  handleGoToNext,
});
</script>

<template>
  <v-window :model-value="step">
    <!-- STEP:1 取引先名入力 -->
    <v-window-item :value="1">
      <v-form ref="step1" @submit.prevent>
        <air-text-field
          v-bind="componentAttrs['customerName']"
          clearable
          hint="取引先名を入力（一部でも可）"
          persistent-hint
        />
      </v-form>
    </v-window-item>

    <!-- STEP:2 取引先選択 -->
    <v-window-item :value="2">
      <div v-if="searchResults.length !== 0">
        <v-alert
          class="mb-2"
          type="info"
          density="compact"
          :text="`${searchResults.length} 件の取引先が見つかりました`"
        />
        <CustomersIterator
          v-bind="componentAttrs['customerId']"
          :customers="searchResults"
          show-select
          select-strategy="single"
        />
      </div>
      <div v-else>
        <v-banner
          class="mb-2"
          color="info"
          icon="mdi-information-symbol"
          density="compact"
          text="指定された条件に該当する取引先は見つかりませんでした。このまま取引先未設定で現場を登録する場合は「次へ」をクリックしてください。"
        />
      </div>
    </v-window-item>

    <!-- STEP:3 現場名入力 -->
    <v-window-item :value="3">
      <v-form ref="step3">
        <v-row>
          <v-col cols="12">
            <air-text-field v-bind="componentAttrs['code']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="componentAttrs['name']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="componentAttrs['nameKana']" />
          </v-col>
          <v-col cols="12">
            <air-postal-code v-bind="componentAttrs['zipcode']" />
          </v-col>
          <v-col cols="12">
            <air-select v-bind="componentAttrs['prefCode']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="componentAttrs['city']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="componentAttrs['address']" />
          </v-col>
          <v-col cols="12">
            <air-text-field v-bind="componentAttrs['building']" />
          </v-col>
        </v-row>
      </v-form>
    </v-window-item>
  </v-window>
</template>
