<script setup>
/**
 * @file ArrangementsTag.vue
 * @description Component for displaying an tag in arrangements.
 * The tag size is set to a height of 48px.
 *
 * @props {Number} amount - The number of workers.
 * @props {Object} cachedEmployees - Cached employee data for label display.
 * @props {Object} cachedOutsourcers - Cached outsourcer data for label display.
 * @props {String} endTime - The end time of the shift.
 * @props {Boolean} highlight - Whether to highlight the employee tag.
 * @props {Boolean} isNew - Indicates 'new' icon.
 * @props {String} label - The label to display on the tag.
 * @props {String} startTime - The start time of the shift.
 * @props {String} status - The status of the arrangement.
 * @props {String} workerId - The ID of the worker.
 * @emits update:status - Event to update the status.
 * @emits remove - Event to remove from the arrangement.
 */
import {
  CONTRACT_STATUS_ACTIVE,
  EMPLOYMENT_STATUS_ACTIVE,
  OPERATION_RESULT_DETAIL_STATUS,
  OPERATION_RESULT_DETAIL_STATUS_ARRAY,
  OPERATION_RESULT_DETAIL_STATUS_DRAFT,
  SITE_OPERATION_SCHEDULE_STATUS_DRAFT,
  SITE_OPERATION_SCHEDULE_STATUS_SCHEDULED,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  /**
   * 人数
   * - Tag に表示される人数。`isEmployee` が false の場合のみ有効。
   */
  amount: { type: Number, default: 0 },
  /**
   * 従業員IDを key とした従業員インスタンスのオブジェクト
   * - 従業員のマスタ情報を参照するために使用します。
   * - useFetchEmployee が提供する cachedEmployees を想定しています。
   */
  cachedEmployees: { type: Object, default: () => ({}) },
  /**
   * 外注先IDを key とした外注先インスタンスのオブジェクト
   * - 外注先のマスタ情報を参照するために使用します。
   * - useFetchOutsourcer が提供する cachedOutsourcers を想定しています。
   */
  cachedOutsourcers: { type: Object, default: () => ({}) },
  /**
   * Tag に表示される終了時刻（例: "18:00"）
   * - `isArranged` が true の場合に表示されます。
   */
  endTime: { type: String, default: undefined },
  /**
   * true の場合、Tag がハイライト表示されます。
   */
  highlight: { type: Boolean, default: false },
  /**
   * true の場合、Tag が配置モードとして表示されます。
   */
  isArranged: { type: Boolean, default: false },
  /**
   * Tag が従業員のものとして扱われます。
   */
  isEmployee: { type: Boolean, default: true },
  /**
   * true の場合、Tag に 'new' アイコンが表示されます。
   */
  isNew: { type: Boolean, default: false },
  /** 現場稼働予定のスケジュール */
  scheduleStatus: { type: String, required: true },
  /**
   * Tag に表示される開始時刻（例: "09:00"）
   * - `isArranged` が true の場合に表示されます。
   */
  startTime: { type: String, default: undefined },
  /**
   * Tag に表示されるステータス
   * - `OPERATION_RESULT_DETAIL_STATUS` の値を使用します。
   * - `isArranged` が true の場合に表示されます。
   */
  status: { type: String, default: OPERATION_RESULT_DETAIL_STATUS.DEFAULT },
  /** 従事者ID */
  workerId: { type: String, required: true },
});

/** define emits */
const emit = defineEmits(["update:status", "remove"]);

/** define refs */
const menu = ref(false);

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
/**
 * Returns the worker object based on whether the worker is an employee or an outsourcer.
 */
const worker = computed(() => {
  return props.isEmployee
    ? props.cachedEmployees[props.workerId]
    : props.cachedOutsourcers[props.workerId];
});

const label = computed(() => {
  return worker.value?.displayName || undefined;
});

/**
 * 従事者の契約状態が `ACTIVE` であるかどうかを返します。
 */
const isActive = computed(() => {
  const prop = props.isEmployee ? "employmentStatus" : "contractStatus";
  const activeStatus = props.isEmployee
    ? EMPLOYMENT_STATUS_ACTIVE
    : CONTRACT_STATUS_ACTIVE;
  return worker.value?.[prop] === activeStatus;
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function updateStatus(newVal) {
  emit("update:status", newVal);
  menu.value = false;
}

/**
 * A handler for the remove button click event.
 * Emits the 'remove' event with the workerId and amount.
 * This is used to remove the worker from the arrangement.
 * `amount` is set to 1 cause the outsourcer's tag should be removed one by one.
 */
function handleClickRemove() {
  const { workerId, isEmployee } = props;
  emit("remove", { workerId, amount: 1, isEmployee });
}
</script>

<template>
  <v-list-item
    class="mb-2"
    style="height: 48px"
    rounded
    variant="outlined"
    :class="{ 'highlighted-employee': props.highlight }"
  >
    <v-list-item-title class="text-subtitle-2">
      <!-- 'new' icon -->
      <v-icon v-if="props.isNew" color="red">mdi-new-box</v-icon>
      <!-- label (shown if props.label is defined) -->
      <span v-if="label">
        {{ label }}
        <span v-if="!props.isEmployee && props.isArranged">
          {{ `(${props.amount})` }}
        </span>
        <v-chip v-if="!isActive" size="x-small" label>退職</v-chip>
      </span>
      <!-- progress circular (shown if props.label is not defined) -->
      <v-progress-circular v-else indeterminate size="x-small" />
    </v-list-item-title>
    <v-list-item-subtitle v-if="isArranged" class="text-caption text-no-wrap">
      {{ `${props.startTime} - ${props.endTime}` }}
    </v-list-item-subtitle>
    <template v-if="isArranged" #append>
      <v-menu
        :disabled="
          props.scheduleStatus === SITE_OPERATION_SCHEDULE_STATUS_DRAFT ||
          props.scheduleStatus === SITE_OPERATION_SCHEDULE_STATUS_SCHEDULED
        "
      >
        <template #activator="{ props: activatorProps }">
          <!-- status chip -->
          <v-chip v-bind="activatorProps" size="x-small" label>
            {{ OPERATION_RESULT_DETAIL_STATUS[props.status] }}
          </v-chip>
        </template>
        <v-card>
          <v-container>
            <v-chip-group>
              <v-chip
                v-for="status in OPERATION_RESULT_DETAIL_STATUS_ARRAY.filter(
                  (s) => s.value !== OPERATION_RESULT_DETAIL_STATUS_DRAFT
                )"
                :key="status.value"
                :value="status.value"
                :disabled="status.value === props.status"
                label
                @click="updateStatus(status.value)"
              >
                {{ status.title }}
              </v-chip>
            </v-chip-group>
          </v-container>
        </v-card>
      </v-menu>
      <v-list-item-action class="mr-2"> </v-list-item-action>
      <v-list-item-action>
        <!-- <v-icon size="small" @click="emit('remove')">mdi-close</v-icon> -->
        <v-icon size="small" @click="handleClickRemove">mdi-close</v-icon>
      </v-list-item-action>
    </template>
  </v-list-item>
</template>

<style scoped>
.highlighted-employee {
  animation: highlight-pulse 2s ease-in-out;
  background-color: rgba(255, 193, 7, 0.3) !important;
  border-color: #ffc107 !important;
  border-width: 2px !important;
}

@keyframes highlight-pulse {
  0% {
    background-color: rgba(255, 193, 7, 0.1);
    transform: scale(1);
  }
  50% {
    background-color: rgba(255, 193, 7, 0.5);
    transform: scale(1.02);
  }
  100% {
    background-color: rgba(255, 193, 7, 0.3);
    transform: scale(1);
  }
}
</style>
