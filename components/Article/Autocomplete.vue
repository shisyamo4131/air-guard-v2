<script setup>
/*****************************************************************************
 * @file ./components/Article/Autocomplete.vue
 * @description A autocomplete component of 'Article'.
 *
 * @note
 * `air-autocomplete-api` に対する設定については `Employee/Autocomplete.vue` のコメントを参照。
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "AutocompleteArticle" });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  label: { type: String, default: "商品" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AutocompleteArticle");
const emit = defineEmits(["update:model-value"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchArticleComposable } = useFetch("ArticleAutocomplete");
const { getArticle, searchArticles } = fetchArticleComposable;

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function api(text) {
  return await searchArticles(text, { returnAllCached: false });
}
</script>

<template>
  <air-autocomplete-api
    :api="api"
    :fetchItemByKeyApi="getArticle"
    :custom-filter="() => true"
    hint="名称入力で検索"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    persistent-hint
    :return-object="returnObject"
    @update:model-value="emit('update:model-value', $event)"
  />
</template>
