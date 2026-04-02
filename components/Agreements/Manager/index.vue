<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Manager/index.vue
 * @description 取極め管理コンポーネント
 * @extends AirArrayManager
 *****************************************************************************/
import dayjs from "dayjs";
import { AgreementV2 } from "@/schemas";
import { useDefaults } from "vuetify";
import { useBaseManager } from "@/composables/useBaseManager";
import AgreementInput from "@/components/Agreement/Input/index.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: { type: Array, default: () => [] },
  shiftType: { type: String, default: "DAY" },
});
const props = useDefaults(_props, "AgreementsManager");
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs: baseManagerAttrs } = useBaseManager("AgreementsManager");

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
const tab = ref(props.shiftType);
const window = ref(0);

/*****************************************************************************
 * DEFINE CONSTANTS
 *****************************************************************************/
/**
 * AirArrayManager の v-model として機能する computed プロパティ
 * - `props.modelValue` 配列から `shiftType` に該当する要素で絞り込み、`date` プロパティの昇順に並び替えたものを返す。
 * - `model` に新しい値がセットされたとき、`props.modelValue` から `shiftType` に該当しないものを抽出し、`newValue` と連結したものを
 *   `update:modelValue` イベントで親コンポーネントに通知する。
 */
const model = computed({
  get() {
    const filtered = props.modelValue.filter(
      ({ shiftType }) => shiftType === tab.value,
    );
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  },
  set(newValue) {
    const filtered = props.modelValue.filter(
      ({ shiftType }) => shiftType !== tab.value,
    );
    emit("update:modelValue", [...filtered, ...newValue]);
  },
});

/**
 * `model` 配列の中で、今日の日付と同じかそれ以前の日付を持つ最後の要素のインデックスを返す computed プロパティ
 * - もしそのような要素が存在しない場合は -1 を返す。
 * - これにより、現在有効な取極めがどれかを特定することができる。
 */
const validIndex = computed(() => {
  const today = dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD");
  for (let index = model.value.length - 1; index >= 0; index -= 1) {
    if (model.value[index].date <= today) {
      return index;
    }
  }

  return -1;
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * `props.shiftType` が変更されるたびに `tab` の値を更新するウォッチャー
 */
watch(
  () => props.shiftType,
  (newShiftType) => (tab.value = newShiftType),
);

/**
 * `validIndex` が変更されるたびに `window` の値を更新するウォッチャー
 * - `validIndex` の新しい値が `window` にセットされる。
 */
watch(validIndex, (newIndex) => (window.value = newIndex), { immediate: true });

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
function next() {
  window.value = window.value + 1 > model.value.length ? 0 : window.value + 1;
}
function prev() {
  window.value =
    window.value - 1 < 0 ? model.value.length - 1 : window.value - 1;
}

/**
 * `window` の値を更新するための関数
 * - `model` 配列の要素が削除された際にこの関数を実行することで
 *   `window` の値が常に有効なインデックスを指すようにする。
 */
function refreshWindow() {
  if (model.value.length === 0 || validIndex.value === -1) {
    window.value = 0;
  } else {
    window.value = validIndex.value;
  }
}
</script>

<template>
  <AirArrayManager
    v-bind="baseManagerAttrs"
    v-model="model"
    :custom-input="AgreementInput"
    :dialog-props="{ maxWidth: 960 }"
    :schema="AgreementV2"
    item-key="key"
    :error-messages="{
      duplicateKey: '同じ適用開始日が存在しています',
    }"
    @delete="refreshWindow"
  >
    <template #table="{ items, toCreate, toUpdate }">
      <v-card title="取極め">
        <!-- ACTIONS -->
        <template #append>
          <v-btn
            icon="mdi-plus"
            size="small"
            @click="() => toCreate({ shiftType: tab })"
          />
          <v-btn
            :disabled="!items.length"
            icon="mdi-pencil"
            size="small"
            variant="text"
            @click="() => toUpdate(items[window])"
          />
        </template>

        <!-- CONTENTS -->
        <v-card-text>
          <v-tabs v-model="tab" fixed-tabs>
            <v-tab value="DAY">日勤</v-tab>
            <v-tab value="NIGHT">夜勤</v-tab>
          </v-tabs>
          <v-window v-if="items.length" v-model="window">
            <v-window-item
              v-for="(agreement, index) in items"
              :key="index"
              :value="index"
            >
              <AgreementTable
                :agreement="agreement"
                :is-valid="index === validIndex"
              />
            </v-window-item>
          </v-window>
          <v-empty-state
            v-else
            icon="mdi-alert-circle-outline"
            title="取極めは登録されていません"
            action-text="登録する"
            @click:action="() => toCreate({ shiftType: tab })"
          />
        </v-card-text>
        <v-card-actions class="justify-space-between">
          <v-btn
            icon="mdi-chevron-left"
            :disabled="window === 0 || !items.length"
            size="small"
            @click="prev"
          ></v-btn>
          <v-btn
            icon="mdi-chevron-right"
            :disabled="window === items.length - 1 || !items.length"
            size="small"
            @click="next"
          ></v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </AirArrayManager>
</template>
