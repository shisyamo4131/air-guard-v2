<script setup>
/*****************************************************************************
 * 稼働予定管理用テーブルヘッダーコンポーネント
 * - `OperationSchedules/Table.vue` で使用されるコンポーネント
 *
 * @slot - prepend-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の前）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - day - 各日付ヘッダーのカスタム表示用スロット
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - append-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の後）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - prepend-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の前）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - weekday - 各曜日ヘッダーのカスタム表示用スロット
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *
 * @slot - append-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の後）
 *         @property {Object} column - @see useDateRange.daysInRangeMap
 *         @property {boolean} isSelected - 日付が選択されているかどうか
 *         @property {Object} holidayIcon - 祝日アイコン用オブジェクト
 *****************************************************************************/
const props = inject("props");
const columns = inject("columns");
</script>

<template>
  <thead>
    <!-- TR:日付 -->
    <tr>
      <th
        v-for="(column, colIndex) in columns"
        :key="colIndex"
        :style="column.style.day"
        :class="column.colorClass"
      >
        <div class="d-flex justify-center">
          <!-- SLOT: prepend-day -->
          <slot
            name="prepend-day"
            v-bind="{
              column,
              isSelected:
                props.selectedDate && props.selectedDate === column.date,
              holidayIcon: {
                icon: props.holidayIcon,
                color: props.holidayIconColor,
                size: 'x-small',
              },
            }"
          />

          <!-- SLOT: day -->
          <slot
            name="day"
            v-bind="{
              column,
              isSelected:
                props.selectedDate && props.selectedDate === column.date,
              holidayIcon: {
                icon: props.holidayIcon,
                color: props.holidayIconColor,
                size: 'x-small',
              },
            }"
          >
            <span>{{ column.format(props.dayFormat) }}</span>
          </slot>

          <!-- SLOT: append-day -->
          <slot
            name="append-day"
            v-bind="{
              column,
              isSelected:
                props.selectedDate && props.selectedDate === column.date,
              holidayIcon: {
                icon: props.holidayIcon,
                color: props.holidayIconColor,
                size: 'x-small',
              },
            }"
          />
        </div>
      </th>
    </tr>

    <!-- TR:曜日 -->
    <tr>
      <th
        v-for="(column, colIndex) in columns"
        :key="colIndex"
        :style="column.style.weekday"
        :class="column.colorClass"
      >
        <div class="d-flex justify-center">
          <!-- SLOT: prepend-weekday -->
          <slot
            name="prepend-weekday"
            v-bind="{
              column,
              isSelected:
                props.selectedDate && props.selectedDate === column.date,
              holidayIcon: {
                icon: props.holidayIcon,
                color: props.holidayIconColor,
                size: 'x-small',
              },
            }"
          />

          <!-- SLOT: weekday -->
          <slot
            name="weekday"
            v-bind="{
              column,
              isSelected:
                props.selectedDate && props.selectedDate === column.date,
              holidayIcon: {
                icon: props.holidayIcon,
                color: props.holidayIconColor,
                size: 'x-small',
              },
            }"
          >
            <div class="d-flex align-center">
              <span>{{ column.format(props.weekdayFormat) }}</span>
              <v-icon
                v-if="column.isHoliday"
                :icon="props.holidayIcon"
                :color="props.holidayIconColor"
                size="x-small"
              />
            </div>
          </slot>

          <!-- SLOT: append-weekday -->
          <slot
            name="append-weekday"
            v-bind="{
              column,
              isSelected:
                props.selectedDate && props.selectedDate === column.date,
              holidayIcon: {
                icon: props.holidayIcon,
                color: props.holidayIconColor,
                size: 'x-small',
              },
            }"
          />
        </div>
      </th>
    </tr>
  </thead>
</template>
