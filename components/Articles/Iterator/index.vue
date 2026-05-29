<script setup>
/*****************************************************************************
 * @file ./components/Articles/Iterator/index.vue
 * @description 商品表示用データイテレーターコンポーネント
 *
 * @property {Array} articles - 表示する商品の配列
 * @property {Boolean} showCreate - 新規登録機能の表示有無
 * @property {Boolean} showEdit - 編集ボタンの表示有無
 * @property {Boolean} showDetail - 詳細ボタンの表示有無
 *
 * @emits click:create - 新規登録ボタンがクリックされたときに発火するイベント
 * @emits click:edit - 編集ボタンがクリックされたときに発火するイベント
 * @emits click:detail - 詳細ボタンがクリックされたときに発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";

defineOptions({ name: "ArticlesIterator" });

const _props = defineProps({
  articles: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  showCreate: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
});
const props = useDefaults(_props, "ArticlesIterator");
const emit = defineEmits(["click:create", "click:detail", "click:edit"]);
</script>

<template>
  <air-data-iterator item-value="docId" :items="props.articles">
    <template v-if="$slots.header" #header="slotProps">
      <slot name="header" v-bind="slotProps" />
    </template>

    <template v-if="$slots.default" #default="slotProps">
      <slot name="default" v-bind="slotProps" />
    </template>

    <template #item="{ item, isSelected, select, showSelect }">
      <ArticleCard
        v-bind="{
          article: item.raw,
          isSelected: isSelected(item),
          showEdit: props.showEdit,
          showDetail: props.showDetail,
          showSelect: showSelect,
          'onClick:detail': () => emit('click:detail', item.raw),
          'onClick:edit': () => emit('click:edit', item.raw),
          'onClick:select': () => select([item], !isSelected(item)),
        }"
        style="position: relative"
      />
    </template>

    <!-- NO DATA -->
    <template #no-data>
      <v-card>
        <v-empty-state
          title="商品はありません"
          icon="mdi-tag-off-outline"
          :action-text="props.showCreate ? '新規登録' : undefined"
          color="primary"
          @click:action="() => emit('click:create')"
        >
          <template #text>
            <div>指定された条件に該当する商品は登録されていません。</div>
          </template>
        </v-empty-state>
      </v-card>
    </template>
  </air-data-iterator>
</template>

<style scoped></style>
