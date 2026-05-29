<script setup>
/*****************************************************************************
 * @file ./components/ArticleDetails/Table/index.vue
 * @description OperationResult.articles 配列を表示するデータテーブルコンポーネント。
 * 商品名・コードは useFetchArticle 経由で Article ドキュメントから参照します。
 * 単価（price）は ArticleDetail に保存された値を使用します。
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArticleDetailsTable", inheritAttrs: false });

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchArticleComposable } = useFetch("ArticleDetailsTable");
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
</script>

<template>
  <air-data-table v-bind="$attrs" :headers="headers" density="compact">
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
  </air-data-table>
</template>
