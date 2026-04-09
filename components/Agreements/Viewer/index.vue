<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Viewer/index.vue
 * @description 勤務区分ごとの取極め情報表示コンポーネント
 * - `AgreementsViewerShiftTyped` を内包し、タブ切り替えで勤務区分ごとの取極め情報を表示するコンポーネント。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { AgreementV2 } from "@/schemas";
import { SHIFT_TYPE_OPTIONS } from "@shisyamo4131/air-guard-v2-schemas/constants";

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  agreements: { type: Array, default: () => [] },
  shiftType: {
    type: String,
    default: "DAY",
    validator: (value) => Object.keys(AgreementV2.SHIFT_TYPE).includes(value),
  },
});
const props = useDefaults(_props, "AgreementsViewer");
const emit = defineEmits(["update:currentAgreement", "update:shiftType"]);

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalShiftType = ref(SHIFT_TYPE_OPTIONS[0].value);
const currentAgreement = ref({ DAY: null, NIGHT: null });

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * `props.shiftType` を監視し、`internalShiftType` と同期する Watcher。
 */
watch(
  () => props.shiftType,
  (newValue) => (internalShiftType.value = newValue),
  { immediate: true },
);

/**
 * `internalShiftType` を監視し、`props.shiftType` と同期する Watcher。
 * - `update:shiftType` イベントを発火して、親コンポーネントに変更を通知する。
 */
watch(internalShiftType, (newValue) => {
  emit("update:shiftType", newValue);
});

/**
 * `currentAgreement`, `internalShiftType` を監視し、現在表示中の取極め情報を親コンポーネントに通知する Watcher。
 * - `currentAgreement` は勤務区分ごとに取極め情報を保持するオブジェクトで、`internalShiftType` に応じた取極め情報を `update:currentAgreement` イベントで通知する。
 * - `watchEffect` を使用して、`currentAgreement` または `internalShiftType` が変更された際に自動的に発火するようにする。
 * - これにより、ユーザーがタブを切り替えた際や、取極め情報が更新された際に、常に最新の取極め情報が親コンポーネントに通知されるようになる。
 */
watchEffect(() => {
  emit(
    "update:currentAgreement",
    currentAgreement.value[internalShiftType.value],
  );
});
/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
</script>

<template>
  <div>
    <ShiftTypeTabs v-model="internalShiftType" fixed-tabs />
    <v-tabs-window v-model="internalShiftType">
      <v-tabs-window-item
        v-for="shiftType in Object.keys(AgreementV2.SHIFT_TYPE)"
        :key="shiftType"
        :value="shiftType"
      >
        <AgreementsViewerShiftTyped
          :agreements="props.agreements"
          :shift-type="shiftType"
          @update:currentAgreement="currentAgreement[shiftType] = $event"
        />
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>
