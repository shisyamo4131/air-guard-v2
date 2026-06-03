<script setup>
/*****************************************************************************
 * @file ./components/ArticleDetails/Table/index.vue
 * @description OperationResult.articles 配列を表示するデータテーブルコンポーネント。
 * 商品名・コードは useFetchArticle 経由で Article ドキュメントから参照します。
 * 単価（price）は ArticleDetail に保存された値を使用します。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArticleDetailsDataTable", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  items: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "ArticleDetailsDataTable");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchArticleComposable } = useFetch("ArticleDetailsDataTable");
const { cachedArticles } = fetchArticleComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const headers = computed(() => [
  { title: "コード", key: "code" },
  { title: "商品名", key: "name" },
  { title: "単価", key: "price" },
  { title: "数量", key: "quantity" },
  { title: "金額", key: "amount" },
]);

const total = computed(() => {
  return props.items.reduce((sum, item) => {
    const price = item.price ?? 0;
    const quantity = item.quantity ?? 0;
    return sum + price * quantity;
  }, 0);
});
</script>

<template>
  <air-data-table
    v-bind="$attrs"
    :headers="headers"
    :items="props.items"
    :items-per-page="-1"
    hide-default-footer
  >
    <template #[`item.code`]="{ item }">
      {{ cachedArticles[item.articleId]?.code ?? "-" }}
    </template>
    <template #[`item.name`]="{ item }">
      {{ cachedArticles[item.articleId]?.name ?? "N/A" }}
    </template>
    <template #[`item.price`]="{ item }">
      {{ (item.price ?? 0).toLocaleString() }}
    </template>
    <template #[`item.amount`]="{ item }">
      {{ ((item.price ?? 0) * (item.quantity ?? 0)).toLocaleString() }}
    </template>
    <template #[`body.append`]>
      <tr>
        <td :colspan="headers.length" class="text-right">合計</td>
        <td class="text-right">{{ total.toLocaleString() }}</td>
      </tr>
    </template>
  </air-data-table>
</template>
