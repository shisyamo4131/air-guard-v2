<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Selector/index.vue
 * @description 取極め選択用ダイアログコンポーネント
 * @use ./composables/useDialogSelector.js - アイテム選択ダイアログ専用の共通ロジックを提供するコンポーザブル
 *
 * @property {Array} agreements - 選択可能な取極めのリスト
 * @property {Object|Array|String|Number|Boolean} modelValue - 選択された値を受け取るプロパティ
 * @property {Boolean} returnObject - true の場合、選択されたオブジェクト全体を返します。false の場合、選択された値のみを返します。
 * @property {String} selectStrategy - 選択戦略を指定するプロパティ。例: "single"（単一選択）や "multiple"（複数選択）など。
 *
 * @emits update:modelValue - 選択された値が変更されたときに発火するイベント
 *****************************************************************************/
import { useDefaults, useDisplay } from "vuetify";
import {
  props as composableProps,
  emits as composableEmits,
  useDialogSelector,
} from "@/composables/useDialogSelector.js";

defineOptions({ name: "AgreementsSelector" });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  agreements: { type: Array, default: () => [] },
  selectStrategy: {
    type: String,
    default: "page",
    validator: (value) => ["single", "page", "all"].includes(value),
  },
  maxWidth: { type: [String, Number], default: "600" },
  useAll: { type: Boolean, default: false },
  ...composableProps,
});
const props = useDefaults(_props, "AgreementsSelector");
const emit = defineEmits(composableEmits);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { dialog, iteratorProps, onSubmit, onCancel } = useDialogSelector(
  props,
  emit,
);
const { mobile } = useDisplay();
</script>

<template>
  <v-dialog
    v-model="dialog"
    :fullscreen="mobile"
    :max-width="props.maxWidth"
    scrollable
  >
    <!-- ACTIVATOR SLOT (PASS THROUGH) -->
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>

    <!-- CONTENT -->
    <v-card>
      <template #title>取極め選択</template>
      <v-card-text class="py-0">
        <AgreementsIterator
          v-bind="iteratorProps"
          :agreements="props.agreements"
          :select-strategy="props.selectStrategy"
          show-expand
          :use-all="props.useAll"
        />
      </v-card-text>
      <template #actions>
        <MoleculesActionsSelectCancel
          @click:select="onSubmit"
          @click:cancel="onCancel"
        />
      </template>
    </v-card>
  </v-dialog>
</template>
