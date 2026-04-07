<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Card/index.vue
 * @description 取極め情報表示用 Card コンポーネント
 * - 複数の取極め情報を表示する Card コンポーネント
 *****************************************************************************/
import dayjs from "dayjs";
import { useDefaults } from "vuetify";
import { AgreementV2 } from "@/schemas";

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  agreements: { type: Array, default: () => [] },
  displayedAgreement: { type: Object, default: null },
  shiftType: {
    type: String,
    default: "DAY",
    validator: (value) => Object.keys(AgreementV2.SHIFT_TYPE).includes(value),
  },
});
const props = useDefaults(_props, "AgreementsCard");

const emit = defineEmits([
  "click:create",
  "click:update",
  "click:duplicate",
  "update:displayedAgreement",
  "update:shiftType",
]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const dayAgreements = ref([]);
const nightAgreements = ref([]);
const internalDisplayedAgreement = ref(null); // 現在表示されている取極め情報を管理する状態
const internalShiftType = ref(props.shiftType); // 現在選択されているシフトタイプを管理する状態
const dayWindow = ref(0); // 日勤の取極め情報の表示に使用するインデックスを管理する状態
const nightWindow = ref(0); // 夜勤の取極め情報の表示に使用するインデックスを管理する状態

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * 現在有効となる取極め情報のインデックスを返す computed プロパティ
 * @returns {Object} - シフトタイプごとに現在有効な取極め情報のインデックスを持つオブジェクト。存在しない場合は -1。
 * - 例えば、`{ DAY: 2, NIGHT: -1 }` は日勤の取極め情報のうち、インデックス 2 のものが現在有効であることを示し、夜勤の取極め情報は現在有効なものが存在しないことを示す。
 */
const validIndex = computed(() => {
  const today = dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD");
  const day = [...dayAgreements.value].findLastIndex(
    ({ date }) => date <= today,
  );
  const night = [...nightAgreements.value].findLastIndex(
    ({ date }) => date <= today,
  );
  return { DAY: day, NIGHT: night };
});

/**
 * 編集ボタンの使用可否を判定する computed プロパティ
 * - `internalShiftType` に応じて、現在表示されている取極め情報が存在するかどうかをチェックし、
 *   存在しない場合は `true` を返し、存在する場合は `false` を返す。
 */
const disabledUpdate = computed(() => {
  if (internalShiftType.value === "DAY") {
    return !dayAgreements.value[dayWindow.value];
  } else {
    return !nightAgreements.value[nightWindow.value];
  }
});

/**
 * 前の取極め情報に移動するボタンの使用可否を判定する computed プロパティ
 * - `internalShiftType` に応じて、現在表示されている取極め情報のインデックスが 0 の場合は前の取極め情報が存在しないため `true` を返し、
 *   それ以外の場合は `false` を返す。
 */
const disabledPrev = computed(() => {
  if (internalShiftType.value === "DAY") {
    return dayWindow.value === 0;
  } else {
    return nightWindow.value === 0;
  }
});

/**
 * 次の取極め情報に移動するボタンの使用可否を判定する computed プロパティ
 * - `internalShiftType` に応じて、現在表示されている取極め情報のインデックスが最後の場合は次の取極め情報が存在しないため `true` を返し、
 *   存在する場合は `false` を返す。
 */
const disabledNext = computed(() => {
  if (internalShiftType.value === "DAY") {
    return !dayAgreements.value[dayWindow.value + 1];
  } else {
    return !nightAgreements.value[nightWindow.value + 1];
  }
});

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * `props.agreements` の変更を監視
 * - `props.agreements` 配列の要素を `shiftType` プロパティでフィルタリングし、
 *   `dayAgreements.value` と `nightAgreements.value` にそれぞれセットするウォッチャー
 * - 同時に要素は `date` プロパティの昇順に並び替えられる。
 */
watch(
  () => props.agreements,
  (newAgreements) => {
    dayAgreements.value = newAgreements
      .filter(({ shiftType }) => shiftType === "DAY")
      .sort((a, b) => a.date.localeCompare(b.date));
    nightAgreements.value = newAgreements
      .filter(({ shiftType }) => shiftType === "NIGHT")
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  { immediate: true },
);
/**
 * `props.displayedAgreement` の変更を監視し、変更された値を `internalDisplayedAgreement.value` に反映するウォッチャー
 * - `internalDisplayedAgreement.value` を引数の新しい値に更新し、`show` 関数を呼び出して対応する取極め情報を表示する。
 */
watch(
  () => props.displayedAgreement,
  (newValue) => show(newValue),
  { immediate: true },
);

/**
 * `props.shiftType` の変更を監視し、変更された値を `internalShiftType.value` に反映するウォッチャー
 */
watch(
  () => props.shiftType,
  (newValue) => (internalShiftType.value = newValue),
);

/**
 * `internalDisplayedAgreement.value` の変更を監視し、変更された値を `update:displayedAgreement` イベントで親コンポーネントに通知するウォッチャー
 */
watch(internalDisplayedAgreement, (newValue) => {
  emit("update:displayedAgreement", newValue);
});

/**
 * `internalShiftType.value` の変更を監視し、変更された値を `update:shiftType` イベントで親コンポーネントに通知するウォッチャー
 */
watch(internalShiftType, (newValue) => {
  emit("update:shiftType", newValue);
});

/**
 * `internalShiftType.value` と `dayWindow.value` および `nightWindow.value` の変更を監視し、
 *  現在表示されている取極め情報を `internalDisplayedAgreement.value` に反映するウォッチャー
 */
watchEffect(() => {
  if (internalShiftType.value === "DAY") {
    internalDisplayedAgreement.value =
      dayAgreements.value[dayWindow.value] || null;
  } else {
    internalDisplayedAgreement.value =
      nightAgreements.value[nightWindow.value] || null;
  }
});

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
/**
 * 追加ボタンがクリックされた時の処理
 * - `click:create` イベントを発火し、現在選択されているシフトタイプを引数として渡す。
 */
function onClickCreate() {
  emit("click:create", internalShiftType.value);
}

/**
 * 編集ボタンがクリックされた時の処理
 * - `click:update` イベントを発火し、現在表示されている取極め情報を引数として渡す。
 */
function onClickUpdate() {
  if (internalShiftType.value === "DAY") {
    emit("click:update", dayAgreements.value[dayWindow.value]);
  } else {
    emit("click:update", nightAgreements.value[nightWindow.value]);
  }
}

/**
 * 複製ボタンがクリックされた時の処理
 * - `click:duplicate` イベントを発火し、現在表示されている取極め情報を引数として渡す。
 */
function onClickDuplicate() {
  if (internalShiftType.value === "DAY") {
    emit("click:duplicate", dayAgreements.value[dayWindow.value]);
  } else {
    emit("click:duplicate", nightAgreements.value[nightWindow.value]);
  }
}

/**
 * 引数で指定された取極め情報を表示するための関数
 * - 引数の `agreement` が `null` の場合は、現在有効な取極め情報を表示する。
 * - `agreement` が `null` でない場合は、`agreement` の `shiftType` に応じて、
 *   対応する取極め情報の配列から `agreement` と同じ `key` を持つ取極め情報を探し、
 *   そのインデックスを `internalShiftType` に応じた `window` にセットする。
 *   - 対応する取極め情報が見つからない場合は、現在有効な取極め情報のインデックスを `window` にセットする。
 * @param {Object|null} agreement - 表示する取極め情報のオブジェクト。`null` の場合は現在有効な取極め情報を表示する。
 * @returns {void}
 */
function show(agreement = null) {
  if (!agreement) {
    if (internalShiftType.value === "DAY") {
      dayWindow.value = validIndex.value.DAY !== -1 ? validIndex.value.DAY : 0;
    } else {
      nightWindow.value =
        validIndex.value.NIGHT !== -1 ? validIndex.value.NIGHT : 0;
    }
    return;
  }

  internalShiftType.value = agreement.shiftType;

  if (internalShiftType.value === "DAY") {
    const index = dayAgreements.value.findIndex(
      ({ key }) => key === agreement.key,
    );
    if (index !== -1) {
      dayWindow.value = index;
    } else {
      dayWindow.value = validIndex.value.DAY !== -1 ? validIndex.value.DAY : 0;
    }
  } else {
    const index = nightAgreements.value.findIndex(
      ({ key }) => key === agreement.key,
    );
    if (index !== -1) {
      nightWindow.value = index;
    } else {
      nightWindow.value =
        validIndex.value.NIGHT !== -1 ? validIndex.value.NIGHT : 0;
    }
  }
}
</script>

<template>
  <v-card title="取極め">
    <!-- ACTIONS -->
    <template #append>
      <v-btn
        icon="mdi-plus"
        size="small"
        variant="text"
        @click="onClickCreate"
      />
      <v-btn
        :disabled="disabledUpdate"
        icon="mdi-pencil"
        size="small"
        variant="text"
        @click="onClickUpdate"
      />
      <v-btn
        :disabled="disabledUpdate"
        icon="mdi-content-copy"
        size="small"
        variant="text"
        @click="onClickDuplicate"
      />
    </template>

    <!-- CONTENTS -->
    <v-card-text style="height: 382px">
      <!-- TABS -->
      <v-tabs v-model="internalShiftType" fixed-tabs>
        <v-tab value="DAY">日勤</v-tab>
        <v-tab value="NIGHT">夜勤</v-tab>
      </v-tabs>

      <v-tabs-window v-model="internalShiftType">
        <v-tabs-window-item value="DAY">
          <!-- WINDOW -->
          <v-window v-if="dayAgreements.length" v-model="dayWindow">
            <!-- WINDOW ITEMS -->
            <v-window-item
              v-for="(agreement, index) in dayAgreements"
              :key="index"
              :value="index"
            >
              <AgreementTable
                :agreement="agreement"
                :is-valid="index === validIndex.DAY"
              />
            </v-window-item>
          </v-window>
          <div v-else class="h-100">
            <v-empty-state
              icon="mdi-alert-circle-outline"
              title="取極めは登録されていません"
              action-text="登録する"
              @click:action="onClickCreate"
            />
          </div>
        </v-tabs-window-item>
        <v-tabs-window-item value="NIGHT">
          <!-- WINDOW -->
          <v-window v-if="nightAgreements.length" v-model="nightWindow">
            <!-- WINDOW ITEMS -->
            <v-window-item
              v-for="(agreement, index) in nightAgreements"
              :key="index"
              :value="index"
            >
              <AgreementTable
                :agreement="agreement"
                :is-valid="index === validIndex.NIGHT"
              />
            </v-window-item>
          </v-window>
          <div v-else class="h-100">
            <v-empty-state
              icon="mdi-alert-circle-outline"
              title="取極めは登録されていません"
              action-text="登録する"
              @click:action="onClickCreate"
            />
          </div>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
    <v-card-actions class="justify-space-between">
      <v-btn
        icon="mdi-chevron-left"
        :disabled="disabledPrev"
        size="small"
        @click="internalShiftType === 'DAY' ? dayWindow-- : nightWindow--"
      ></v-btn>
      <v-btn
        icon="mdi-chevron-right"
        :disabled="disabledNext"
        size="small"
        @click="internalShiftType === 'DAY' ? dayWindow++ : nightWindow++"
      ></v-btn>
    </v-card-actions>
  </v-card>
</template>
