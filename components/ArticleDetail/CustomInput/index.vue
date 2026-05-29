<script setup>
/*****************************************************************************
 * @file ./components/ArticleDetail/CustomInput/index.vue
 * @description 商品明細登録用のカスタム入力コンポーネント。
 * Article を Autocomplete で選択すると articleId と price（初期値）を更新します。
 * price は稼働実績ごとに上書き可能です。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import ArticleAutocomplete from "@/components/Article/Autocomplete.vue";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArticleDetailCustomInput" });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  componentAttrs: { type: Object, default: () => ({}) },
  updateProperties: { type: Function, default: () => {} },
});
const props = useDefaults(_props, "ArticleDetailCustomInput");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchArticleComposable } = useFetch("ArticleDetailCustomInput");
const { getArticle } = fetchArticleComposable;

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * 商品が選択されたとき、articleId と price（Article の単価を初期値）を更新します。
 * @param {string|null} articleId - 選択された商品の docId
 */
async function onArticleSelected(articleId) {
  if (!articleId) {
    props.updateProperties({ articleId: null, price: 0 });
    return;
  }
  const article = await getArticle(articleId);
  props.updateProperties({
    articleId,
    price: article?.price ?? 0,
  });
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <ArticleAutocomplete
        :model-value="props.componentAttrs['articleId']?.modelValue"
        required
        @update:model-value="onArticleSelected"
      />
    </v-col>
    <v-col cols="12">
      <air-number-input v-bind="props.componentAttrs['price']" />
    </v-col>
    <v-col cols="12">
      <air-number-input v-bind="props.componentAttrs['quantity']" />
    </v-col>
  </v-row>
</template>
