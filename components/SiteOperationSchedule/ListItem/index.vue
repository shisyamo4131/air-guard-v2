<script setup>
/**
 * 現場稼働予定 ListItem コンポーネント
 * - `SiteOperationSchedule` インスタンスを受け取り、ListItem として情報を表示します。
 *
 * @property {Object} modelValue - 現場稼働予定ドキュメントモデル
 * @slots prepend - リストアイテムの先頭に表示するコンテンツ
 * @slots title - リストアイテムのタイトル部分に表示するコンテンツ
 * @slots subtitle - リストアイテムのサブタイトル部分に表示するコンテンツ
 * @slots append - リストアイテムの末尾に表示するコンテンツ
 */
import { useDefaults } from "vuetify";
import { SiteOperationSchedule } from "@/schemas";
import { useIndex } from "./useIndex";

/**
 * SETUP PROPS
 */
const _props = defineProps({
  modelValue: {
    type: Object,
    required: true,
    validator: (v) => toRaw(v) instanceof SiteOperationSchedule,
  },
});
const props = useDefaults(_props, "SiteOperationScheduleListItem");

/**
 * SETUP COMPOSABLES
 */
const { title, showQualificationIcon, requiredPersonnel, time } =
  useIndex(props);
</script>

<template>
  <v-list-item>
    <!-- SLOT: prepend -->
    <template #prepend="slotProps">
      <slot name="prepend" v-bind="slotProps" />
    </template>

    <!-- SLOT: title -->
    <template #title>
      <slot name="title">
        <AtomsIconsHasLicense v-if="showQualificationIcon" class="mr-1" />
        <span>{{ title }}</span>
      </slot>
    </template>

    <!-- SLOT: subtitle -->
    <template #subtitle>
      <slot name="subtitle">
        <div class="d-flex flex-column">
          <div class="mb-1">必要人員数: {{ requiredPersonnel }}</div>
          <div class="mb-1">時間: {{ time }}</div>
        </div>
      </slot>
    </template>

    <!-- SLOT: append -->
    <template #append="slotProps">
      <slot name="append" v-bind="slotProps" />
    </template>
  </v-list-item>
</template>
