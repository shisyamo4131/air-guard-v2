<script setup>
/*****************************************************************************
 * @file ./components/Agreement/Input/RateSet.vue
 * @description 曜日区分限定単価情報入力コンポーネント
 * - DayTypeRates インスタンスを受け取り、単価情報を表示・編集するためのコンポーネントです。
 * - `selectedDayTypes` で複数の曜日区分を選択し、同一の単価情報を一括で編集することができます。
 * @extends AirItemManager
 *
 * @property {string} dayType - 曜日区分（各種単価の初期値として使用する曜日区分）
 * @property {boolean} disabled - 入力の有効/無効を切り替えるフラグ
 * @property {DayTypeRates} modelValue - 単価情報 (DayTypeRates インスタンス)
 *****************************************************************************/
import { DayTypeRates } from "@/schemas";
import { useConstants } from "@/composables/useConstants";

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
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { DAY_TYPE, toArray } = useConstants();

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const selectedDayTypes = ref([props.dayType]);

/*****************************************************************************
 * COMPUTED
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
    selectedDayTypes.value.forEach((type) => {
      newModel[type] = newValue;
    });
    emit("update:modelValue", newModel);
  },
});

const selectableDayTypes = computed(() => {
  return toArray(DAY_TYPE.value);
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

/**
 * AirItemManager の `initialized` フック関数
 * - コンポーネントの初期化時に、`selectedDayTypes` を `props.dayType` のみを含む配列に設定することで、初期状態では `props.dayType` に対応する単価情報のみが編集対象となるようにする。
 */
function initialized() {
  selectedDayTypes.value = [props.dayType];
}
</script>

<template>
  <air-item-manager
    v-model="model"
    hide-delete-btn
    :dialog-props="{ maxWidth: 360 }"
    @initialized="initialized"
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
      <div class="mb-6">
        <v-alert
          class="text-caption mb-4"
          color="info"
          icon="mdi-information"
          density="compact"
          text="単価を設定する曜日を選択してください。"
        />
        <v-btn-toggle
          v-model="selectedDayTypes"
          class="w-100"
          color="primary"
          density="compact"
          divided
          mandatory
          multiple
          variant="outlined"
        >
          <v-btn
            v-for="type of selectableDayTypes"
            :key="type.value"
            class="flex-grow-1"
            :text="type.title"
            :value="type.value"
          />
        </v-btn-toggle>
      </div>
      <div class="d-flex ga-4">
        <air-number-input
          v-bind="componentAttrs['unitPriceBase']"
          control-variant="hidden"
        />
        <air-number-input
          v-bind="componentAttrs['overtimeUnitPriceBase']"
          control-variant="hidden"
        />
      </div>
      <div class="d-flex ga-4">
        <air-number-input
          v-bind="componentAttrs['unitPriceQualified']"
          control-variant="hidden"
        />
        <air-number-input
          v-bind="componentAttrs['overtimeUnitPriceQualified']"
          control-variant="hidden"
        />
      </div>
    </template>
  </air-item-manager>
</template>
