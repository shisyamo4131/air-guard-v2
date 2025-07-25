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
async function handleWorkerAdded(addedEvent) {
  const { workerId, isEmployee, amount } = addedEvent.element;
  props.schedule.addWorker(workerId, isEmployee, amount, addedEvent.newIndex);
}

async function handleWorkerRemoved(removedEvent) {
  const { workerId, isEmployee, amount } = removedEvent.element;
  props.schedule.removeWorker(workerId, amount, isEmployee);
}

async function handleWorkerMoved(movedEvent) {
  const { isEmployee } = movedEvent.element;
  props.schedule.changeWorker(
    movedEvent.oldIndex,
    movedEvent.newIndex,
    isEmployee
  );
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
    await props.schedule.update();
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
    <v-card-title class="text-subtitle-2">
      {{
        `${props.schedule.workDescription || "通常警備"}(${
          props.schedule.requiredPersonnel
        })`
      }}
      <span v-if="props.schedule.isPersonnelShortage">
        <v-icon color="error" size="small">mdi-information</v-icon>
      </span>
    </v-card-title>
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
            handleWorkerRemoved({ element: $event });
            props.schedule.update();
          "
        />
      </template>
    </draggable>
  </v-card>
</template>
