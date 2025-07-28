<script setup>
/**
 * @file DraggableCell.vue
 * @description 単一の現場稼働予定に対して従事者（従業員または外注先）の配置を行うためのコンポーネント。
 * vuedraggable を使用しており、以下の仕様になっています。
 * - `workers` グループからのみ要素を受け入れます。
 * - props.schedule.employees と props.schedule.outsourcers を結合して表示します。
 * - 外注先の要素は強制的に従業員要素の後ろに配置されます。
 * - 要素が従業員なのか、外注先なのかは `isEmployee` プロパティで判定します。
 * - vuedraggable の `change` イベントを使用して、要素の追加、削除、移動をハンドリングします。
 *   -> 変更が生じた場合は props.schedule.update() を呼び出して、直接 Firestore ドキュメントを更新します。
 */
import draggable from "vuedraggable";
import { useLogger } from "@/composables/useLogger";
import {
  SITE_OPERATION_SCHEDULE_STATUS,
  SITE_OPERATION_SCHEDULE_STATUS_DRAFT,
  SITE_OPERATION_SCHEDULE_STATUS_SCHEDULED,
} from "air-guard-v2-schemas/constants";

/** define props */
const props = defineProps({
  /**
   * 従業員情報
   * - Tag コンポーネントに引き渡されます。
   */
  cachedEmployees: { type: Object, required: true },
  /**
   * 外注先情報
   * - Tag コンポーネントに引き渡されます。
   */
  cachedOutsourcers: { type: Object, required: true },
  /**
   * 現場稼働予定のドキュメント
   */
  schedule: { type: Object, required: true },
});

/** define composables */
const logger = useLogger();

/** define refs for highlighting existing employees */
const highlightedEmployees = ref(new Set());

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const label = computed(() => {
  return props.schedule.workDescription || "通常警備";
});

// Returns a function to get the display name of a worker.
const getWorkerDisplayName = computed(() => {
  return (element) => {
    const cache = element.isEmployee
      ? props.cachedEmployees
      : props.cachedOutsourcers;
    return cache[element.workerId]?.displayName;
  };
});

/**
 * Check if the detail status can be changed based on the current schedule status.
 * - Detail status can be changed if the schedule is not in `DRAFT` or `SCHEDULED` state.
 */
const isDetailStatusChangeable = computed(() => {
  const status = props.schedule.status;
  return (
    status !== SITE_OPERATION_SCHEDULE_STATUS_DRAFT &&
    status !== SITE_OPERATION_SCHEDULE_STATUS_SCHEDULED
  );
});

/*****************************************************************************
 * METHODS
 *****************************************************************************/
async function handleWorkerAdded(addedEvent) {
  const { workerId, isEmployee, amount } = addedEvent.element;
  props.schedule.addWorker(workerId, isEmployee, amount, addedEvent.newIndex);
  await props.schedule.update();
}

async function handleWorkerRemoved(removedEvent) {
  const { workerId, isEmployee, amount } = removedEvent.element;
  props.schedule.removeWorker(workerId, amount, isEmployee);
  await props.schedule.update();
}

async function handleWorkerMoved(movedEvent) {
  const { isEmployee } = movedEvent.element;
  props.schedule.changeWorker(
    movedEvent.oldIndex,
    movedEvent.newIndex,
    isEmployee
  );
  await props.schedule.update();
}

/**
 * vuedraggable の change ハンドラ
 * @param event
 */
async function handleChange(event) {
  logger.clearError();
  try {
    if (event.added) {
      await handleWorkerAdded(event.added);
    } else if (event.removed) {
      await handleWorkerRemoved(event.removed);
    } else if (event.moved) {
      await handleWorkerMoved(event.moved);
    }
  } catch (error) {
    logger.error({ sender: "handleChange", message: error.message, error });
  }
}

/**
 * vuedraggable の put ハンドラ
 * - 作業員（OperationResultDetail）のみを受け入れる
 * - ドロップされようとしている要素が従業員であれば、当該従業員が既に配置されているかどうかをチェック
 * - 既に配置されている従業員であれば強調表示し、put を拒否
 * - そうでなければ put を許可
 * @param to
 * @param from
 * @param dragEl
 */
function handlePut(to, from, dragEl) {
  // ドラッグされた要素の元のgroup nameで判定
  const fromGroupName =
    from.el.getAttribute("data-group") || from.options?.group?.name;

  // workersグループからの要素のみ受け入れ
  if (fromGroupName !== "workers") {
    return false;
  }

  // ドラッグされた要素を取得
  const element = dragEl.__draggable_context.element;

  // 要素が存在しない場合は拒否
  if (!element) return false;

  // 外注先の場合は許可（重複チェック不要）
  if (!element.isEmployee) return true;

  // 従事者IDを取得
  const workerId = element.workerId;

  // 従事者IDが取得できなければ false を返す -> put を拒否
  if (!workerId) return false;

  // 既に配置されている従業員かどうかをチェック
  const isExisting = props.schedule.employees.some(
    (emp) => emp.workerId === workerId
  );

  // 既に配置されている従業員であれば強調表示
  if (isExisting) {
    // 既存従業員を強調表示
    highlightExistingEmployee(props.schedule.docId, workerId);
    return false;
  } else {
    return true;
  }
}

/**
 * Update the detail status of the worker in the schedule.
 * @param {Object} workerInstance - The worker instance to update.
 * @param {String} newStatus - The new status to set.
 */
async function handleUpdateDetailStatus(workerInstance, newStatus) {
  workerInstance.status = newStatus;
  await props.schedule.update();
}

/**
 * 既に配置されている従業員を強調表示する
 * - 強調表示は2秒間持続し、その後自動的に解除
 * @param scheduleId
 * @param employeeId
 */
function highlightExistingEmployee(scheduleId, employeeId) {
  const key = `${scheduleId}-${employeeId}`;
  if (highlightedEmployees.value.has(key)) return; // 既に強調表示されている場合は何もしない
  highlightedEmployees.value.add(key);

  // 2秒後に強調表示を解除
  setTimeout(() => {
    highlightedEmployees.value.delete(key);
  }, 2000);
}
</script>

<template>
  <v-card flat style="border: 1px dashed grey">
    <v-card-title class="text-subtitle-2 font-weight-regular pb-0">
      <v-icon
        v-if="props.schedule.isPersonnelShortage"
        color="error"
        size="small"
      >
        mdi-information
      </v-icon>
      {{ `${label}(${props.schedule.requiredPersonnel})` }}
      <!-- 状態遷移を確認するためのコンポーネント（後で削除）-->
      <v-chip label size="x-small">
        {{ SITE_OPERATION_SCHEDULE_STATUS[props.schedule.status] }}
      </v-chip>
    </v-card-title>
    <v-container class="py-0 d-flex justify-center" style="column-gap: 20px">
      <v-checkbox
        :model-value="!props.schedule.isDraft"
        color="primary"
        :readonly="!props.schedule.isDraft && !props.schedule.isScheduled"
        hide-details
        density="compact"
        style="height: 32px"
        @update:modelValue="
          ($event) =>
            $event ? props.schedule.toScheduled() : props.schedule.toDraft()
        "
      >
        <template #label>
          <span class="text-caption">予定確定</span>
        </template>
      </v-checkbox>
      <v-checkbox
        :model-value="props.schedule.isArranged"
        color="primary"
        density="compact"
        :disabled="!props.schedule.isScheduled && !props.schedule.isArranged"
        hide-details
        style="height: 32px"
        @update:modelValue="
          ($event) =>
            $event ? props.schedule.toArranged() : props.schedule.toScheduled()
        "
      >
        <template #label>
          <span class="text-caption">配置確定</span>
        </template>
      </v-checkbox>
    </v-container>
    <draggable
      class="px-2 pt-2"
      :model-value="props.schedule.employees.concat(props.schedule.outsourcers)"
      tag="div"
      item-key="workerId"
      style="min-height: 24px"
      :group="{ name: 'workers', put: handlePut }"
      @change="handleChange($event)"
    >
      <template #item="{ element }">
        <ArrangementsWorkerTag
          v-bind="element"
          is-arranged
          :label="getWorkerDisplayName(element)"
          :highlight="
            highlightedEmployees.has(
              `${props.schedule.docId}-${element.workerId}`
            )
          "
          :is-status-changeable="isDetailStatusChangeable"
          @update:status="handleUpdateDetailStatus(element, $event)"
          @remove="handleWorkerRemoved({ element: $event })"
        />
      </template>
    </draggable>
  </v-card>
</template>
