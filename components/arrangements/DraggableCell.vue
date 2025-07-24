<script setup>
/**
 * @file DraggableCell.vue
 * @description 単一の現場稼働予定に対して従事者（従業員または外注先）の配置を行うためのコンポーネント。
 */
import draggable from "vuedraggable";
import { useLogger } from "@/composables/useLogger";

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
 * METHODS
 *****************************************************************************/
async function handleWorkerAdded(addedEvent, schedule) {
  const { workerId, isEmployee, amount } = addedEvent.element;
  schedule.addWorker(workerId, isEmployee, amount, addedEvent.newIndex);
}

async function handleWorkerRemoved(removedEvent, schedule) {
  const { workerId, isEmployee, amount } = removedEvent.element;
  schedule.removeWorker(workerId, amount, isEmployee);
}

async function handleWorkerMoved(movedEvent, schedule) {
  const { isEmployee } = movedEvent.element;
  schedule.changeWorker(movedEvent.oldIndex, movedEvent.newIndex, isEmployee);
}

/**
 * vuedraggable の change ハンドラ
 * @param event
 * @param schedule
 */
async function handleChange(event, schedule) {
  logger.clearError();
  try {
    if (event.added) {
      await handleWorkerAdded(event.added, schedule);
    } else if (event.removed) {
      await handleWorkerRemoved(event.removed, schedule);
    } else if (event.moved) {
      await handleWorkerMoved(event.moved, schedule);
    }
    await schedule.update();
  } catch (error) {
    logger.error({ sender: "handleChange", message: error.message, error });
  }
}

/**
 * vuedraggable の put ハンドラ
 * - ドロップされようとしている要素が従業員であれば、当該従業員が既に配置されているかどうかをチェック
 * - 既に配置されている従業員であれば強調表示し、put を拒否
 * - そうでなければ put を許可
 * @param to
 * @param from
 * @param dragEl
 */
function handlePut(to, from, dragEl) {
  // ドラッグされた要素を取得
  const element = dragEl.__draggable_context.element;

  // 要素が存在しない、または要素が従業員でない場合は true を返す -> put を許可
  if (!element || !element.isEmployee) return true;

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
  <v-card flat style="border: 1px solid grey">
    <draggable
      class="px-2 pt-2"
      :model-value="props.schedule.employees.concat(props.schedule.outsourcers)"
      key="workerId"
      tag="div"
      item-key="workerId"
      style="min-height: 24px"
      :group="{ name: 'workers', put: handlePut }"
      @change="handleChange($event, props.schedule)"
    >
      <template #item="{ element }">
        <ArrangementsTag
          v-bind="element"
          is-arranged
          :cached-employees="props.cachedEmployees"
          :cached-outsourcers="props.cachedOutsourcers"
          :highlight="
            highlightedEmployees.has(
              `${props.schedule.docId}-${element.workerId}`
            )
          "
          @update:status="
            (newVal) => {
              element.status = newVal;
              props.schedule.update();
            }
          "
          @remove="
            handleWorkerRemoved({ element: $event }, schedule);
            schedule.update();
          "
        />
      </template>
    </draggable>
  </v-card>
</template>
