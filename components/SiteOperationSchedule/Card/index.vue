<script setup>
/*****************************************************************************
 * 現場稼働予定管理用カードコンポーネント
 * - 現場稼働予定をカード形式で表示します。
 *
 * @prop {Boolean} hideBadge - 必要人数バッジを非表示にするかどうか（デフォルト: false）
 * @prop {Object} schedule - 現場稼働予定データオブジェクト（デフォルト: 空の SiteOperationSchedule インスタンス）
 * @prop {Boolean} showActions - アクションボタンを表示するかどうか（デフォルト: false）
 * @prop {Boolean} isDraggable - カードのドラッグ操作用アイコンを表示するかどうか（デフォルト: false）
 *
 * @emits click:notify - 作業員への通知ボタンがクリックされたときに発火
 * @emits click:duplicate - 複製ボタンがクリックされたときに発火
 * @emits click:edit - 編集ボタンがクリックされたときに発火
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { SiteOperationSchedule } from "@/schemas";
import PersonnelAvatar from "./PersonnelAvatar.vue";
import Actions from "./Actions.vue";

/*****************************************************************************
 * SETUP PROPS
 *****************************************************************************/
const _props = defineProps({
  hideBadge: { type: Boolean, default: false },
  schedule: { type: Object, default: () => new SiteOperationSchedule() },
  showActions: { type: Boolean, default: false },
  isDraggable: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SiteOperationScheduleCard");

/*****************************************************************************
 * SETUP EMITS
 *****************************************************************************/
const emit = defineEmits(["click:notify", "click:duplicate", "click:edit"]);

/**
 * v-card-title のクラスを返します。
 */
const titleClass = computed(() => {
  return ["d-flex", "text-subtitle-1", "font-weight-regular", "align-center"];
});

/**
 * ドラッグアイコンを表示するかどうかを返します。
 */
const isDraggable = computed(() => {
  return props.schedule.isEditable && props.isDraggable;
});

/**
 * 開始終了時間の文字列を返します。
 */
const timeLabel = computed(() => {
  return `${props.schedule.startTime} - ${props.schedule.endTime}`;
});

provide("props", props);
provide("emit", emit);
</script>

<template>
  <v-container>
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
            <v-chip
              class="mr-1"
              label
              size="x-small"
              text="要資格"
              color="red"
            />
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

      <v-card-text style="padding: 0px 10px">
        <!-- SLOT: default -->
        <slot name="default">
          {{ props.schedule.remarks || "特記事項なし" }}
        </slot>
      </v-card-text>

      <!-- ACTIONS -->
      <Actions v-if="props.showActions" />
    </v-card>
  </v-container>
</template>
