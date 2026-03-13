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
 * @prop {Boolean} showExpand - 単価情報表示スイッチ表示フラグ
 * @prop {Boolean} showSelect - 選択アイコン表示フラグ
 *
 * @emit click:select - 選択アイコンクリックイベント
 * @emit click:edit - 編集アイコンクリックイベント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useIndex } from "./useIndex";
import EditBtn from "./EditBtn.vue";
import ShowPricesSwitch from "./ShowPricesSwitch.vue";

/** SETUP PROPS */
const _props = defineProps({
  agreement: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showExpand: { type: Boolean, default: true },
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
  timeLabel,
  isExpanded,
} = useIndex(props, emit);
</script>

<template>
  <v-card style="min-width: 252px">
    <!-- ヘッダー（勤務区分表示部）-->
    <v-card-text :class="['pa-2', `bg-${shiftTypeColor}`]" style="height: 36px">
      <div class="d-flex align-center">
        <v-icon :icon="shiftTypeIcon" class="me-1" />
        <span>{{ shiftTypeLabel }}</span>
        <v-spacer />
        <v-icon v-if="props.showSelect" v-bind="selectIconProps" />
      </div>
    </v-card-text>

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
          <td>時間</td>
          <td>{{ timeLabel }}</td>
        </tr>
      </tbody>
    </v-table>

    <!-- 単価情報テーブル -->
    <v-expand-transition>
      <div v-if="isExpanded">
        <v-divider />
        <v-table class="rounded-0 text-caption" density="compact">
          <tbody>
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
      </div>
    </v-expand-transition>

    <!-- アクション -->
    <div v-if="props.showEdit || props.showExpand">
      <v-divider />
      <v-card-actions class="py-0" style="min-height: 36px">
        <!-- 単価情報表示スイッチ -->
        <ShowPricesSwitch v-if="props.showExpand" />
        <v-spacer />
        <!-- 編集ボタン -->
        <EditBtn v-if="props.showEdit" />
      </v-card-actions>
    </div>
  </v-card>
</template>

<style scoped>
td:nth-child(2) {
  text-align: right;
}
</style>
