<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Card/index.vue
 * @description 取極め情報表示コンポーネント
 * @author shisyamo4131
 *
 * @prop {Object} agreement - 取極め情報オブジェクト
 * @prop {Boolean} disabled - コンポーネント全体の操作不可フラグ
 * @prop {Boolean} loading - ローディング状態フラグ
 * @prop {Boolean} isSelected - 選択状態フラグ
 * @prop {Boolean} showEdit - 編集アイコン表示フラグ
 * @prop {Boolean} showSelect - 選択アイコン表示フラグ
 *
 * @emit click:select - 選択アイコンクリックイベント
 * @emit click:edit - 編集アイコンクリックイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";

/** SETUP PROPS */
const _props = defineProps({
  agreement: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementCard");

const emit = defineEmits(["click:select", "click:edit"]);

/** SETUP COMPOSABLE */
const {
  dateAtLabel,
  formatted,
  dayType,
  shiftTypeColor,
  shiftTypeIcon,
  shiftTypeLabel,
  selectIconProps,
  actionProps,
} = useIndex(props, emit);
</script>

<template>
  <v-card style="min-width: 234px">
    <!-- ヘッダー（勤務区分表示部）-->
    <v-card-text :class="['pa-2', `bg-${shiftTypeColor}`]" style="height: 36px">
      <div class="d-flex align-center">
        <v-icon :icon="shiftTypeIcon" class="me-1" />
        <span>{{ shiftTypeLabel }}</span>
        <v-spacer />
        <v-icon v-if="props.showSelect" v-bind="selectIconProps" />
      </div>
    </v-card-text>

    <!-- 単価情報テーブル -->
    <v-table class="rounded-0 text-caption" density="compact">
      <tbody>
        <tr>
          <td>適用開始</td>
          <td>{{ dateAtLabel }}</td>
        </tr>
        <tr>
          <td>曜日区分</td>
          <td>
            <DayTypeChip
              :day-type="dayType"
              label
              density="compact"
              size="small"
            />
          </td>
        </tr>
        <tr>
          <td>基本単価</td>
          <td>{{ formatted.unitPriceBase }}</td>
        </tr>
        <tr>
          <td>残業単価</td>
          <td>{{ formatted.overTimeUnitPriceBase }}</td>
        </tr>
        <tr>
          <td>資格単価</td>
          <td>{{ formatted.unitPriceQualified }}</td>
        </tr>
        <tr>
          <td>資格残業</td>
          <td>{{ formatted.overTimeUnitPriceQualified }}</td>
        </tr>
      </tbody>
    </v-table>

    <v-divider />

    <!-- 編集アクション -->
    <v-card-actions v-if="props.showEdit" class="py-0" style="min-height: 36px">
      <MoleculesActionsEdit v-bind="actionProps" />
    </v-card-actions>
  </v-card>
</template>

<style scoped>
td:nth-child(2) {
  text-align: right;
}
</style>
