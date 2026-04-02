<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Input/RateSet.vue
 * @description 曜日区分限定単価情報入力コンポーネント
 * - DayTypeRates インスタンスを受け取り、指定された曜日区分の単価情報を表示・編集する。
 * @extends AirItemManager
 *
 * @property {string} dayType - 曜日区分
 * @property {boolean} disabled - 入力の有効/無効を切り替えるフラグ
 * @property {DayTypeRates} modelValue - 単価情報 (DayTypeRates インスタンス)
 *****************************************************************************/
import { DayTypeRates } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const props = defineProps({
  dayType: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    required: true,
    validator: (value) => value instanceof DayTypeRates,
  },
});

const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * DEFINE CONSTANTS
 *****************************************************************************/
/**
 * AirItemManager の v-model として機能する computed プロパティ
 * - `props.modelValue` は `DayTypeRates` インスタンスであり、
 *   指定された `dayType` に対応する末端ノードである `RateSet` インスタンスを取得・更新する。
 */
const model = computed({
  get() {
    return props.modelValue[props.dayType];
  },
  set(newValue) {
    const newModel = new DayTypeRates(props.modelValue);
    newModel[props.dayType] = newValue;
    emit("update:modelValue", newModel);
  },
});

/*****************************************************************************
 * DEFINE METHODS
 *****************************************************************************/
function priceLabel(isQualified, isBase) {
  const priceType = isBase ? "unitPrice" : "overtimeUnitPrice";
  const qualificationType = isQualified ? "Qualified" : "Base";
  const field = `${priceType}${qualificationType}`;
  const price = props.modelValue?.[props.dayType]?.[field] ?? null;
  if (price === null) {
    console.warn(`No price data for dayType: ${props.dayType}`);
    return "N/A";
  }
  return price.toLocaleString();
}
</script>

<template>
  <air-item-manager
    v-model="model"
    hide-delete-btn
    :dialog-props="{ maxWidth: 360 }"
  >
    <template #activator="{ props: activatorProps }">
      <v-card>
        <v-table>
          <thead>
            <tr>
              <th></th>
              <th style="text-align: right">基本単価</th>
              <th style="text-align: right">残業単価</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>通常</td>
              <td style="text-align: right">{{ priceLabel(false, true) }}</td>
              <td style="text-align: right">
                {{ priceLabel(false, false) }}
              </td>
            </tr>
            <tr>
              <td>資格者</td>
              <td style="text-align: right">{{ priceLabel(true, true) }}</td>
              <td style="text-align: right">
                {{ priceLabel(true, false) }}
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-divider />
        <v-card-actions>
          <MoleculesActionsEdit
            v-bind="activatorProps"
            :disabled="props.disabled"
          />
        </v-card-actions>
      </v-card>
    </template>
    <template #input-default="{ componentAttrs }">
      <v-col cols="12">
        <air-number-input v-bind="componentAttrs['unitPriceBase']" />
      </v-col>
      <v-col cols="12">
        <air-number-input v-bind="componentAttrs['overtimeUnitPriceBase']" />
      </v-col>
      <v-col cols="12">
        <air-number-input v-bind="componentAttrs['unitPriceQualified']" />
      </v-col>
      <v-col cols="12">
        <air-number-input
          v-bind="componentAttrs['overtimeUnitPriceQualified']"
        />
      </v-col>
    </template>
  </air-item-manager>
</template>
