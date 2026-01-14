<script setup>
/**
 * MoleculesInputsSiteForSelectCustomer
 * @file @/components/molecules/inputs/SiteForSelectCustomer.vue
 * @author shisyamo4131
 * @description 現場情報取引先選択用コンポーネント
 * - ステップ入力を行うコンポーネントで、AirItemInput.vue の `default` スロットで使用することを前提としています。
 * - 仮登録状態現場の取引先選択に対応しています。
 */
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  step: { type: Number, default: 1 },
});

const fetchCustomerComposable = useFetchCustomer();
const { searchCustomers } = fetchCustomerComposable;

// ステップ1で入力された取引先名での検索結果を格納する配列
const searchResults = ref([]);

// 各ステップの VForm の参照
const step1 = ref(null);
const step2 = ref(null); // 一旦未使用状態でOK

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
  }
}

defineExpose({
  mode: "step",
  steps: 2,
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
              v-for="customer of searchResults"
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
  </v-window>
</template>
