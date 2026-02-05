<script setup>
/**
 * Tag
 * @file ./components/Tag/index.vue
 * @description VListItem をベースにした、汎用的なタグコンポーネントです。
 * - Vuetify の v-list-item コンポーネントを拡張して、タグ表示に特化したスタイルと機能を提供します。
 * - タグのサイズ、バリアント、読み込み状態、削除ボタンなどのカスタマイズが可能です。
 * - `inheritAttrs: false` を指定して、不要な属性の継承を防止しています。
 *
 * @property {String | Number | Boolean} border - タグの枠線を表示するかどうか。
 * @property {Boolean} highlight - タグを強調表示するかどうか。
 * @property {Boolean} isDraggable - ドラッグ可能アイコンを表示するかどうか。
 * @property {String} label - タグに表示するラベル文字列。
 * @property {Boolean} loading - タグが読み込み中状態かどうか。
 * @property {Boolean} removable - タグに削除ボタンを表示するかどうか。
 * @property {String} removeIcon - 削除ボタンのアイコン。
 * @property {String | Number | Boolean} rounded - タグの角を丸くするかどうか。
 * @property {String} size - タグのサイズ。('small', 'medium', 'large')。
 * @property {String} variant - タグのバリアント。('default', 'success', 'warning', 'error', 'disabled')。
 *
 * @slots
 * - prepend-label: ラベルの前に表示するコンテンツ。
 * - label: カスタムラベルコンテンツ。
 * - append-label: ラベルの後に表示するコンテンツ。
 * - append: 追加エリアのコンテンツ。
 * - footer: フッターエリアのコンテンツ。
 * - prepend-action: 先頭アクションエリアのコンテンツ。
 * - action: カスタムクリアボタンコンテンツ。
 * - append-action: 追加アクションエリアのコンテンツ。
 *
 * @emits click:remove - 削除ボタンがクリックされたときに発火します。
 */
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex.js";
import importedProps from "./props";

defineOptions({ inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps(importedProps);
const props = useDefaults(_props, "Tag");
const emit = defineEmits(["click:remove"]);

const {
  tagClasses,
  tagHeight,
  titleClasses,
  progressSize,
  isLoading,
  showLoadingText,
  removeButtonAttrs,
} = useIndex(props, emit);
</script>

<template>
  <v-list-item
    :class="tagClasses"
    :style="{ height: tagHeight }"
    :border="props.border"
    rounded
  >
    <v-list-item-title :class="titleClasses">
      <!-- Label content (shown when label is available and not loading) -->
      <div v-if="!isLoading" class="tag-base__label-content">
        <!-- Draggable Icon -->
        <AtomsIconsDraggable v-if="props.isDraggable" />

        <!-- SLOT: prepend-label -->
        <slot name="prepend-label" v-bind="{ label: props.label }" />

        <!-- SLOT: label -->
        <slot name="label" v-bind="{ label: props.label }">
          {{ props.label }}
        </slot>

        <!-- SLOT: append-label -->
        <slot name="append-label" v-bind="{ label: props.label }" />
      </div>

      <!-- Loading indicator (shown when loading or no label) -->
      <div v-else class="tag-base__loading">
        <v-progress-circular
          indeterminate
          :size="progressSize"
          aria-label="読み込み中"
        />
        <span v-if="showLoadingText" class="tag-base__loading-text ml-2">
          読み込み中...
        </span>
      </div>
    </v-list-item-title>

    <!-- Footer slot -->
    <div class="text-truncate">
      <slot name="footer" />
    </div>

    <!-- Append content -->
    <template #append>
      <slot name="append">
        <v-list-item-action v-if="$slots['prepend-action']">
          <slot name="prepend-action" />
        </v-list-item-action>
        <v-list-item-action v-if="props.removable" class="pl-2">
          <slot name="action" v-bind="removeButtonAttrs">
            <v-icon v-bind="removeButtonAttrs" />
          </slot>
        </v-list-item-action>
        <v-list-item-action v-if="$slots['append-action']" class="pl-2">
          <slot name="append-action" />
        </v-list-item-action>
      </slot>
    </template>
  </v-list-item>
</template>

<style scoped>
.tag-base {
  margin-bottom: 8px;
}

.tag-base__title {
  display: flex;
  align-items: center;
  min-height: 100%;
}

.tag-base__label-content {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.tag-base__loading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.tag-base__loading-text {
  font-size: 0.75rem;
  opacity: 0.7;
}

/* Size variants */
.tag-base--small {
  padding: 4px 8px;
}

.tag-base--medium {
  padding: 8px 8px;
}

.tag-base--large {
  padding: 12px 8px;
}

/* Color variants */
.tag-base--success {
  background-color: rgba(76, 175, 80, 0.1) !important;
  border-color: #4caf50 !important;
}

.tag-base--warning {
  background-color: rgba(255, 152, 0, 0.1) !important;
  border-color: #ff9800 !important;
}

.tag-base--error {
  background-color: rgba(244, 67, 54, 0.1) !important;
  border-color: #f44336 !important;
}

/* 追加: disabled variant */
.tag-base--disabled {
  background-color: rgba(158, 158, 158, 0.1) !important;
  border-color: #9e9e9e !important;
  opacity: 0.6 !important;
  color: #9e9e9e !important;
}

.tag-base--disabled .tag-base__title {
  color: #9e9e9e !important;
}

.tag-base--disabled .v-icon {
  color: #9e9e9e !important;
}

/* Highlighted state */
.tag-base--highlighted {
  background-color: rgba(255, 193, 7, 0.3) !important;
  border-color: #ffc107 !important;
  border-width: 2px !important;
}

/* Loading state */
.tag-base--loading {
  opacity: 0.8;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .tag-base--large {
    padding: 8px 12px;
  }

  .tag-base__loading-text {
    display: none; /* モバイルでは読み込みテキストを非表示 */
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .tag-base--success {
    background-color: rgba(76, 175, 80, 0.2) !important;
  }

  .tag-base--warning {
    background-color: rgba(255, 152, 0, 0.2) !important;
  }

  .tag-base--error {
    background-color: rgba(244, 67, 54, 0.2) !important;
  }

  /* 追加: disabled variant for dark theme */
  .tag-base--disabled {
    background-color: rgba(97, 97, 97, 0.2) !important;
    border-color: #616161 !important;
    color: #616161 !important;
  }

  .tag-base--disabled .tag-base__title {
    color: #616161 !important;
  }

  .tag-base--disabled .v-icon {
    color: #616161 !important;
  }
}
</style>
