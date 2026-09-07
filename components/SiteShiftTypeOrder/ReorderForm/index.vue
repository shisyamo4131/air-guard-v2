<script setup>
/*****************************************************************************
 * @file ./components/SiteShiftTypeOrder/ReorderForm/index.vue
 * @description 現場勤務区分オーダーの並び替えを行うコンポーネント
 * - `Draft State Pattern` を使用して、内部モデル値を管理
 * - ユーザーの操作結果は `submit` イベントで通知
 *
 * @property {Array} siteShiftTypeOrder - 現場勤務区分オーダーの配列
 * @property {Boolean} loading - ローディング状態
 *
 * @emit {Function} submit - 並び替えた現場勤務区分オーダーの配列を引数に取るイベント
 * @emit {Function} cancel - キャンセル時に発火するイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "SiteShiftTypeOrderReorderForm",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  siteShiftTypeOrder: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  saveFailed: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SiteShiftTypeOrderReorderForm");
const emit = defineEmits(["submit", "cancel"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const {
  items,
  init,
  cancel,
  controlsDisabled,
  hasExternalChanges,
  isBusy,
  isChanged,
  isResolving,
  reloadLatest,
  resolutionError,
  submit,
} = useIndex(props, emit);

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({ init, submit, cancel });
</script>

<template>
  <v-card :border="false">
    <v-toolbar color="secondary" density="compact" flat>
      <v-toolbar-title>
        <v-icon icon="mdi-sort" class="mr-2" />
        <slot name="title">現場勤務区分並べ替え</slot>
      </v-toolbar-title>
    </v-toolbar>
    <v-card-item>
      <v-card-subtitle class="text-wrap">
        <slot name="subtitle">
          ドラッグで入れ替えて順序を変更します。
        </slot>
      </v-card-subtitle>
    </v-card-item>
    <v-card-text>
      <v-alert
        v-if="hasExternalChanges"
        type="warning"
        variant="tonal"
        class="mb-4"
      >
        <div>
          別の画面で表示順が更新されました。現在の並び順は保存できません。
        </div>
        <v-btn
          class="mt-3"
          size="small"
          variant="outlined"
          :disabled="isBusy"
          @click="reloadLatest"
        >
          最新値を読み直す
        </v-btn>
      </v-alert>
      <v-alert
        v-if="resolutionError"
        type="error"
        variant="tonal"
        class="mb-4"
      >
        <div>{{ resolutionError }}</div>
        <v-btn
          class="mt-3"
          size="small"
          variant="outlined"
          :disabled="isBusy"
          @click="reloadLatest"
        >
          再読み込み
        </v-btn>
      </v-alert>
      <v-progress-linear v-if="isResolving" indeterminate class="mb-4" />
      <DraggableSiteShiftTypeOrder
        v-model="items"
        :disabled="controlsDisabled || hasExternalChanges"
      />
    </v-card-text>
    <v-card-actions>
      <v-btn variant="text" :disabled="isBusy" @click="cancel">
        キャンセル
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        :disabled="controlsDisabled || hasExternalChanges || !isChanged"
        @click="submit"
      >
        保存
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
