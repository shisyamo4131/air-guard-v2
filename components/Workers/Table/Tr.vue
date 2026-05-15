<script setup>
/*****************************************************************************
 * @file ./components/Workers/Table/Tr.vue
 * @description `./components/Workers/Table/index.vue` 内で使用される、作業員情報を表示するテーブル行コンポーネント。
 * - `props.worker` を受け取り、作業員の勤務時間、休憩時間、残業時間を表示します。
 * - `props.arrangementNotification` を受け取ると、状態が `LEAVED` の場合に配置通知の内容に応じた勤務時間、休憩時間、残業時間を表示します。
 * @extends TR
 * @depends useFetch - 作業員の情報を取得するために使用。
 *
 * @property {ArrangementNotification|null} arrangementNotification - 作業員に関連する配置通知ドキュメント。存在しない場合はnull。
 * @property {OperationDetail} worker - 作業員の勤務情報を含むドキュメント。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { OperationDetail, ArrangementNotification } from "@/schemas";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  arrangementNotification: {
    type: Object,
    default: null,
    validator: (v) => v === null || v instanceof ArrangementNotification,
  },
  worker: {
    type: Object,
    required: true,
    validator: (v) => v instanceof OperationDetail,
  },
});
const props = useDefaults(_props, "WorkersTableTr");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchEmployeeComposable, fetchOutsourcerComposable } =
  useFetch("WorkersTableTr");
const { fetchEmployee, cachedEmployees } = fetchEmployeeComposable;
const { fetchOutsourcer, cachedOutsourcers } = fetchOutsourcerComposable;

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
/**
 * `props.worker` を監視し、`fetchEmployee` または `fetchOutsourcer` を呼び出して作業員の情報を取得します。
 */
watch(
  () => props.worker,
  (newVal) => {
    if (newVal) {
      newVal.isEmployee ? fetchEmployee(newVal.id) : fetchOutsourcer(newVal.id);
    }
  },
  { immediate: true, deep: true },
);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * 作業員名を返します。
 * - `props.worker.isEmployee` が `true` の場合は `cachedEmployees` から、
 *   そうでない場合は `cachedOutsourcers` から作業員の表示名を取得して返します。
 */
const displayName = computed(() => {
  const cachedData = props.worker.isEmployee
    ? cachedEmployees
    : cachedOutsourcers;
  return cachedData.value[props.worker.id]?.displayName || "...loading";
});

/**
 * 勤務時間を返します。
 * - `props.arrangementNotification` が存在し、その状態が `LEAVED` の場合は、配置通知の実際の勤務時間を表示します。
 * - それ以外の場合は、作業員の予定勤務時間を表示します。
 */
const time = computed(() => {
  if (
    props.arrangementNotification?.status ===
    ArrangementNotification.STATUS.LEAVED.value
  ) {
    return `${props.arrangementNotification.actualStartTime} - ${props.arrangementNotification.actualEndTime}`;
  }
  return `${props.worker.startTime} - ${props.worker.endTime}`;
});

/**
 * 休憩時間を返します。
 * - `props.arrangementNotification` が存在し、その状態が `LEAVED` の場合は、配置通知の実際の休憩時間を表示します。
 * - それ以外の場合は、作業員の予定休憩時間を表示します。
 */
const breakMinutes = computed(() => {
  if (
    props.arrangementNotification?.status ===
    ArrangementNotification.STATUS.LEAVED.value
  ) {
    return props.arrangementNotification.actualBreakMinutes;
  }
  return props.worker.breakMinutes;
});

/**
 * 残業時間を返します。
 * - `props.arrangementNotification` が存在し、その状態が `LEAVED` の場合は、配置通知の実際の残業時間を表示します。
 * - それ以外の場合は、作業員の予定残業時間を表示します。
 */
const overtimeWorkMinutes = computed(() => {
  if (
    props.arrangementNotification?.status ===
    ArrangementNotification.STATUS.LEAVED.value
  ) {
    return props.arrangementNotification.overtimeWorkMinutes;
  }
  return props.worker.overtimeWorkMinutes;
});

const slotProps = computed(() => {
  return {
    worker: props.worker,
    arrangementNotification: props.arrangementNotification,
  };
});
</script>

<template>
  <tr>
    <slot name="prepend" v-bind="slotProps" />
    <td>
      <slot name="name" v-bind="slotProps">
        {{ displayName }}
      </slot>
    </td>
    <td>
      <slot name="time" v-bind="slotProps">
        {{ time }}
      </slot>
    </td>
    <td>
      <slot name="break" v-bind="slotProps"> {{ breakMinutes }}分 </slot>
    </td>
    <td>
      <slot name="overtimeWorkMinutes" v-bind="slotProps">
        {{ overtimeWorkMinutes }}分
      </slot>
    </td>
    <slot name="append" v-bind="slotProps" />
  </tr>
</template>
