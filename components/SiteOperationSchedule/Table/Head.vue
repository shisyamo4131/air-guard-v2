<script setup>
/*****************************************************************************
 * 現場稼働予定管理用テーブルヘッダーコンポーネント
 * - `SiteOperationSchedule/Table.vue` で使用されるコンポーネント
 *
 * @slot - prepend-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の前）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *
 * @slot - day - 各日付ヘッダーのカスタム表示用スロット
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *
 * @slot - append-day - 各日付ヘッダーのカスタム表示用スロット（ヘッダー日付表示部の後）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *
 * @slot - prepend-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の前）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *
 * @slot - weekday - 各曜日ヘッダーのカスタム表示用スロット
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *
 * @slot - append-weekday - 各曜日ヘッダーのカスタム表示用スロット（ヘッダー曜日表示部の後）
 *         @property {Object} dayObject - @see useDateRange.daysInRangeMap
 *****************************************************************************/
const props = inject("props");
const daysInRangeArray = inject("daysInRangeArray");
const cellColorClass = inject("cellColorClass");
const resolvedDayHeight = inject("resolvedDayHeight");
const resolvedWeekdayHeight = inject("resolvedWeekdayHeight");
</script>

<template>
  <thead>
    <!-- TR:日付 -->
    <tr>
      <th
        v-for="(dayObject, colIndex) in daysInRangeArray"
        :key="colIndex"
        :style="{ height: resolvedDayHeight }"
        :class="[
          cellColorClass[dayObject.format('d')],
          dayObject?.isHoliday ? cellColorClass[0] : '',
        ]"
      >
        <div class="d-flex justify-center">
          <!-- SLOT: prepend-day -->
          <slot name="prepend-day" v-bind="{ dayObject }" />

          <!-- SLOT: day -->
          <slot name="day" v-bind="{ dayObject }">
            <span>{{ dayObject.format(props.dayFormat) }}</span>
          </slot>

          <!-- SLOT: append-day -->
          <slot name="append-day" v-bind="{ dayObject }" />
        </div>
      </th>
    </tr>

    <!-- TR:曜日 -->
    <tr>
      <th
        v-for="(dayObject, colIndex) in daysInRangeArray"
        :key="colIndex"
        :style="{ height: resolvedWeekdayHeight }"
        :class="[
          cellColorClass[dayObject.format('d')],
          dayObject?.isHoliday ? cellColorClass[0] : '',
        ]"
      >
        <div class="d-flex justify-center">
          <!-- SLOT: prepend-weekday -->
          <slot name="prepend-weekday" v-bind="{ dayObject }" />

          <!-- SLOT: weekday -->
          <slot name="weekday" v-bind="{ dayObject }">
            <div class="d-flex align-center">
              <span>{{ dayObject.format(props.weekdayFormat) }}</span>
              <v-icon
                v-if="dayObject.isHoliday"
                :icon="props.holidayIcon"
                :color="props.holidayIconColor"
                size="small"
              />
            </div>
          </slot>

          <!-- SLOT: append-weekday -->
          <slot name="append-weekday" v-bind="{ dayObject }" />
        </div>
      </th>
    </tr>
  </thead>
</template>
