<script setup>
/*****************************************************************************
 * 現場稼働予定管理用カードコンポーネント
 * - 現場稼働予定をカード形式で表示します。
 * - このコンポーネント自身は現場稼働予定データを編集する機能は持ちませんが
 *   楽観的更新のために `props.schedule` で受け取った現場稼働予定データを複製して
 *   管理します。
 *   デフォルトスロットに差し込まれた編集用コンポーネントが onUpdate:schedule イベントを
 *   受け取ると、自身が管理する現場稼働予定データを更新し、さらに update:schedule イベントを
 *   発火して編集後の現場稼働予定データを親コンポーネントに伝達します。
 *
 * @prop {Boolean} hideBadge - 必要人数バッジを非表示にするかどうか（デフォルト: false）
 * @prop {Boolean} isDraggable - カードのドラッグ操作用アイコンを表示するかどうか（デフォルト: false）
 * @prop {Object} schedule - 現場稼働予定データオブジェクト（デフォルト: 空の SiteOperationSchedule インスタンス）
 * @prop {Boolean} showActions - アクションボタンを表示するかどうか（デフォルト: false）
 *
 * @slot default - カード本文のスロット。スロットスコープで `schedule` を受け取ります。
 *
 * @emits click:notify - 作業員への通知ボタンがクリックされたときに発火
 * @emits click:duplicate - 複製ボタンがクリックされたときに発火
 * @emits click:edit - 編集ボタンがクリックされたときに発火
 * @emits update:schedule - 現場稼働予定データが更新されたときに発火
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { SiteOperationSchedule } from "@/schemas";
import PersonnelAvatar from "./PersonnelAvatar.vue";
import Actions from "./Actions.vue";
import { useIndex } from "./useIndex";

/*****************************************************************************
 * SETUP PROPS
 *****************************************************************************/
const _props = defineProps({
  hideBadge: { type: Boolean, default: false },
  isDraggable: { type: Boolean, default: false },
  schedule: {
    type: Object,
    default: () => new SiteOperationSchedule(),
    validator: (val) => val instanceof SiteOperationSchedule,
  },
  showActions: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SiteOperationScheduleCard");

/*****************************************************************************
 * SETUP EMITS
 *****************************************************************************/
const emit = defineEmits([
  "click:notify",
  "click:duplicate",
  "click:edit",
  "update:schedule",
]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { titleClass, isDraggable, timeLabel, defaultSlotProps } = useIndex(
  props,
  emit,
);

provide("props", props);
provide("emit", emit);
</script>

<template>
  <v-card class="schedule-card">
    <v-card-item style="padding: 10px">
      <template #prepend>
        <!-- 必要人数 -->
        <PersonnelAvatar v-if="!props.hideBadge" />
      </template>

      <!-- タイトル -->
      <v-card-title :class="titleClass">
        <!-- 作業内容 -->
        <span
          class="d-flex align-center flex-grow-1 text-truncate"
          style="min-width: 0"
        >
          <!-- 要資格チップ -->
          <v-chip class="mr-1" label size="x-small" text="要資格" color="red" />
          {{ props.schedule.workDescription || "通常警備" }}
        </span>
      </v-card-title>
      <template #append>
        <!-- ドラッグアイコン -->
        <AtomsIconsDraggable v-if="isDraggable" />
      </template>

      <!-- 人数不足メッセージ -->
      <v-card-subtitle
        v-if="props.schedule.isPersonnelShortage"
        class="text-caption"
      >
        {{ timeLabel }}
        <div class="text-error">必要人数を満たしていません。</div>
      </v-card-subtitle>
    </v-card-item>

    <v-card-text style="padding: 0px 8px">
      <!-- SLOT: default -->
      <slot name="default" v-bind="defaultSlotProps" />
    </v-card-text>

    <!-- ACTIONS -->
    <Actions v-if="props.showActions" />
  </v-card>
</template>
