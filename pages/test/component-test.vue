<script setup>
import dayjs from "dayjs";

const viewMode = ref("months");
const modelValue = ref(undefined);

// 現在日時（UTC）を基準に月初、月末の Date オブジェクトを用意
// -> timezone を指定しないと実行環境依存になるため注意。
const defaultValue = {
  from: dayjs().tz("Asia/Tokyo").startOf("month").toDate(),
  to: dayjs().tz("Asia/Tokyo").endOf("month").toDate(),
};

/**
 * コンポーネントの内部値として使用する `modelValue` です。
 */
const normalizedModelValue = computed({
  get() {
    // modelValue が指定されていない、または `from`, `to` プロパティを持たない場合は
    // `defaultValue` を使用する。
    if (!modelValue.value || !modelValue.value.from || !modelValue.value.to) {
      return defaultValue;
    }

    // 引数を Date オブジェクトに変換する関数
    // - 文字列であれば当該日時を JST 環境のものと判断
    // - Date オブジェクトであればそのまま返す
    const convertToDate = (value) => {
      if (typeof value === "string") {
        return dayjs.tz(value, "Asia/Tokyo").toDate();
      } else if (value instanceof Date) {
        return value;
      } else {
        // その他の場合は dayjs で変換
        return dayjs(value).toDate();
      }
    };

    // convertToDate を使って Date オブジェクトで from, to を生成して返す
    const from = convertToDate(modelValue.value.from);
    const to = convertToDate(modelValue.value.to);
    return { from, to };
  },
  set(newValue) {
    // コンポーネント内で実行されるため、{ from, to } を信頼して `modelValue` にセット
    modelValue.value = newValue;
  },
});

/**
 * DatePicker にバインドさせる値を返します。
 * - normalizedModelValue.from (UTC) を返します。
 */
const modelValueToBinding = computed(() => {
  return normalizedModelValue.value.from;
});

/**
 * DatePicker の `view-mode` を制御します。
 * @param mode
 */
function onViewModeChange(mode) {
  // 日選択ビューに遷移しようとしたら強制的に月ビューに戻す
  viewMode.value = mode === "month" ? "months" : mode;
}

/**
 * DatePicker の `month` が変更された時の処理です。
 * - `normalizedModelValue` の from, to を指定された月の範囲に更新します。
 * @param month
 */
function updateMonthValue(month) {
  const dayObj = dayjs(modelValueToBinding.value).tz("Asia/Tokyo");
  const from = dayObj.month(month).startOf("month").toDate();
  const to = dayObj.endOf("month").toDate();
  normalizedModelValue.value = { from, to };
}

/**
 * DatePicker の `year` が変更された時の処理です。
 * - `normalizedModelValue` の from, to を指定された年で更新します。
 * - うるう年に対応するため、from, to は再計算します。
 * @param year
 */
function updateYearValue(year) {
  const dayObj = dayjs(modelValueToBinding.value).tz("Asia/Tokyo");
  const from = dayObj.year(year).startOf("month").toDate();
  const to = dayObj.endOf("month").toDate();
  normalizedModelValue.value = { from, to };
}
</script>

<template>
  <div>
    <v-date-picker
      :model-value="modelValueToBinding"
      :view-mode="viewMode"
      @update:view-mode="onViewModeChange"
      @update:month="updateMonthValue"
      @update:year="updateYearValue"
    />
    <v-container>
      <v-list>
        <v-list-item>
          <template #title>{{ modelValue }}</template>
          <template #subtitle>modelValue</template>
        </v-list-item>
        <v-list-item>
          <template #title>{{ normalizedModelValue }}</template>
          <template #subtitle>normalized</template>
        </v-list-item>
        <v-list-item>
          <template #title>{{ modelValueToBinding }}</template>
          <template #subtitle>modelValueToBinding</template>
        </v-list-item>
      </v-list>
    </v-container>
  </div>
</template>
