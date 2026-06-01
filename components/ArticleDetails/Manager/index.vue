<script setup>
/*****************************************************************************
 * @file ./components/ArticleDetails/Manager/index.vue
 * @description 商品明細（ArticleDetail）配列の CRUD 管理コンポーネント。
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { ArticleDetail } from "@/schemas";
// COMPOSABLES
import { useBaseManager } from "@/composables/useBaseManager";
// COMPONENTS
import CustomInput from "@/components/ArticleDetail/CustomInput/index.vue";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArticleDetailsManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  tableProps: { type: Object, default: () => ({}) },
});
const props = useDefaults(_props, "ArticleDetailsManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("ArticleDetailsManager");
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :schema="ArticleDetail"
    item-key="articleId"
    :table-props="{ ...props.tableProps, hideSearch: true }"
    :custom-input="props.customInput"
  >
    <template #header="{ disabled, toCreate }">
      <v-toolbar color="secondary" density="compact" title="商品">
        <v-spacer />
        <v-btn :disabled="disabled" icon="mdi-plus" @click="toCreate()" />
      </v-toolbar>
    </template>
    <template #table="tableProps">
      <ArticleDetailsTable v-bind="tableProps" />
    </template>
  </air-array-manager>
</template>
