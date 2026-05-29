<script setup>
/*****************************************************************************
 * @file ./components/Article/Card/index.vue
 * @description 商品カードコンポーネント
 *
 * @property {Article} article - 表示する商品のデータ
 * @property {boolean} isSelected - カードの選択状態
 * @property {boolean} showDetail - 詳細表示アクションの表示有無
 * @property {boolean} showEdit - 編集アクションの表示有無
 * @property {boolean} showSelect - 選択チェックボックスの表示有無
 *
 * @emits click:select - 選択チェックボックスのクリックイベント
 * @emits click:edit - 編集アクションのクリックイベント
 * @emits click:detail - 詳細アクションのクリックイベント
 *****************************************************************************/
import * as Vue from "vue";
import { Article } from "@/schemas";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  article: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Article,
  },
  isSelected: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
});
const props = useDefaults(_props, "ArticleCard");
const emit = defineEmits(["click:select", "click:edit", "click:detail"]);

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
const showActions = Vue.computed(() => props.showEdit || props.showDetail);
</script>

<template>
  <v-card>
    <v-card-item :class="{ 'pb-0': showActions }">
      <template #prepend>
        <v-avatar size="40" color="grey-lighten-3">
          <v-icon>mdi-tag-outline</v-icon>
        </v-avatar>
      </template>

      <!-- 選択チェックボックス -->
      <template #append>
        <v-icon
          v-if="props.showSelect"
          :color="props.isSelected ? 'primary' : undefined"
          size="small"
          @click="emit('click:select')"
        >
          {{
            props.isSelected
              ? "mdi-checkbox-marked"
              : "mdi-checkbox-blank-outline"
          }}
        </v-icon>
      </template>

      <!-- 商品コードと名称 -->
      <v-card-title>
        <div class="text-caption text-medium-emphasis text-truncate">
          {{ props.article.code ? `No. ${props.article.code}` : "コードなし" }}
        </div>
        <div class="text-subtitle-1 text-truncate" style="line-height: 1">
          {{ props.article.name }}
        </div>
      </v-card-title>
      <v-card-subtitle class="text-caption">
        {{ `単価: ¥${props.article.price?.toLocaleString() ?? 0}` }}
      </v-card-subtitle>
    </v-card-item>

    <!-- 編集・詳細アクション -->
    <v-card-actions
      v-if="showActions"
      :class="{ 'pt-0': showActions, 'justify-end': true }"
    >
      <v-btn
        v-if="props.showEdit"
        icon="mdi-pencil"
        size="small"
        @click="emit('click:edit', props.article)"
      />
      <v-btn
        v-if="props.showDetail"
        icon="mdi-chevron-right"
        size="small"
        @click="emit('click:detail', props.article)"
      />
    </v-card-actions>
  </v-card>
</template>
