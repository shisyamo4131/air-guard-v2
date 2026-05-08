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
// 検索結果に「取引先を設定しない」オプションを追加した計算済みプロパティ
const computedSearchResults = computed(() => {
  return [
    { docId: null, name: "設定しない", fullAddress: "後で設定します" },
    ...searchResults.value,
  ];
});

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
    <v-window-item :value="1">
      <v-form ref="step1" @submit.prevent>
        <air-text-field v-bind="componentAttrs['customerName']" clearable />
      </v-form>
    </v-window-item>
    <v-window-item :value="2">
      <v-card variant="flat" :border="false">
        <v-item-group
          v-bind="componentAttrs['customerId']"
          selected-class="bg-primary"
        >
          <!-- 検索結果のアイテム -->
          <v-row>
            <v-col
              cols="6"
              v-for="customer of computedSearchResults"
              :key="customer.docId"
            >
              <v-item
                :value="customer.docId"
                v-slot="{ selectedClass, toggle }"
              >
                <v-card :class="selectedClass" @click="toggle">
                  <v-list-item>
                    <template #title>{{ customer.name }}</template>
                    <template #subtitle>{{ customer.fullAddress }}</template>
                  </v-list-item>
                </v-card>
              </v-item>
            </v-col>
          </v-row>
        </v-item-group>
      </v-card>
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
