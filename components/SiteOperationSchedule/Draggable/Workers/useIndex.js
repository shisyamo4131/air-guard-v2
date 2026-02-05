/*****************************************************************************
 * SiteOperationScheduleDraggableWorker 専用コンポーザブル
 *****************************************************************************/
import * as Vue from "vue";
import { SiteOperationSchedule } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import { useTimedSet } from "@/composables/useTimedSet"; // 既配置作業員の強調表示用

export function useIndex(props, emit) {
  /*****************************************************************************
   * SETUP COMPOSABLES
   *****************************************************************************/
  const { logger, isDev } = useBaseManager(
    "SiteOperationScheduleDraggableWorkers",
  );

  // 既配置作業員の強調表示用タイムドセット
  const { add: highlightEmployee } = useTimedSet({ timeout: 2000 });

  /*****************************************************************************
   * SETUP STATES
   *****************************************************************************/
  // 内部管理用の schedule オブジェクト
  // - props.schedule を監視して更新する
  const internalSchedule = Vue.ref(new SiteOperationSchedule(props.modelValue));
  Vue.watch(
    () => props.modelValue,
    (newSchedule) => {
      internalSchedule.value.initialize(newSchedule);
    },
    // { immediate: true, deep: true },
    { immediate: true },
  );

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 現場稼働予定に対して作業員を追加します。
   * @param {Object} param - { id, isEmployee }
   * @param {string} param.id - 追加する作業員のID（従業員IDまたは外注先ID）
   * @param {boolean} param.isEmployee - 追加する作業員が従業員か外注先かのフラグ
   * @param {number} newIndex - 追加する位置のインデックス（省略時は0）
   * @return {void}
   * @throws {Error} - SiteOperationSchedule.addWorker メソッドでエラーが発生した場合にスローされます。
   */
  function addWorker({ id, isEmployee } = {}, newIndex = 0) {
    // ログ出力（開発環境のみ）
    if (isDev) {
      logger.info({
        message: `Adding worker (ID: ${id}, isEmployee: ${isEmployee}) at index ${newIndex}`,
      });
    }

    // addWorker メソッドを呼び出して作業員を追加
    internalSchedule.value.addWorker({ id, isEmployee }, newIndex);
  }

  /**
   * 現場稼働予定内の作業員を移動します。
   * @param {Object} param - { oldIndex, newIndex, isEmployee }
   * @param {number} param.oldIndex - 移動元のインデックス
   * @param {number} param.newIndex - 移動先のインデックス
   * @param {boolean} param.isEmployee - 移動する作業員が従業員か外注先かのフラグ
   * @return {void}
   * @throws {Error} - 従業員と外注先の順序が不正な場合にエラーをスローします。
   * @throws {Error} - SiteOperationSchedule.moveWorker メソッドでエラーが発生した場合にスローされます。
   */
  function moveWorker({ oldIndex, newIndex, isEmployee } = {}) {
    // ログ出力（開発環境のみ）
    if (isDev) {
      logger.info({
        message: `Moving worker (isEmployee: ${isEmployee}) from index ${oldIndex} to ${newIndex}`,
      });
    }

    // 現時点での従業員の数を取得
    const employeesCount = internalSchedule.value.employees.length;

    // 従業員と外注先の順序が正しいかを検証
    if (isEmployee && newIndex > employeesCount - 1) {
      throw new Error("従業員は外注先の前に配置する必要があります。");
    } else if (!isEmployee && newIndex <= employeesCount - 1) {
      throw new Error("外注先は従業員の後に配置する必要があります。");
    }

    // moveWorker メソッドを呼び出して作業員を移動
    internalSchedule.value.moveWorker({ oldIndex, newIndex, isEmployee });
  }

  /**
   * 現場稼働予定から作業員を削除します。
   * @param {Object} param - { workerId, isEmployee }
   * @param {string} param.workerId - 削除する作業員のID（従業員IDまたは外注先ID）
   * @param {boolean} param.isEmployee - 削除する作業員が従業員か外注先かのフラグ
   * @return {void}
   * @throws {Error} - SiteOperationSchedule.removeWorker メソッドでエラーが発生した場合にスローされます。
   */
  function removeWorker({ workerId, isEmployee } = {}) {
    // ログ出力（開発環境のみ）
    if (isDev) {
      logger.info({
        message: `Removing worker (ID: ${workerId}, isEmployee: ${isEmployee})`,
      });
    }

    // removeWorker メソッドを呼び出して作業員を削除
    internalSchedule.value.removeWorker({ workerId, isEmployee });
  }

  /**
   * vue-draggable の change イベントハンドラ
   * - イベントの種類に応じて addWorker, moveWorker, removeWorker を呼び出す
   * - 変更後の schedule オブジェクトを親コンポーネントに通知する
   * @param {Object} event - vue-draggable の change イベントオブジェクト
   * @return {void}
   */
  function handleChange(event) {
    // ログ出力（開発環境のみ）
    if (isDev) {
      logger.info({ message: `Workers changed: ${JSON.stringify(event)}` });
    }

    try {
      // イベントの種類を判定して対応するメソッドを呼び出す
      const { added, moved, removed } = event;
      if (added) {
        const { element, newIndex } = added;
        const { id, isEmployee } = element;
        addWorker({ id, isEmployee }, newIndex);
      } else if (moved) {
        const { oldIndex, newIndex, element } = moved;
        const { isEmployee } = element;
        moveWorker({ oldIndex, newIndex, isEmployee });
      } else if (removed) {
        const { workerId, isEmployee } = removed?.element ?? {};
        removeWorker({ workerId, isEmployee });
      }

      // 変更後の schedule オブジェクトを親コンポーネントに通知
      emit("update:modelValue", internalSchedule.value);
    } catch (error) {
      logger.error({ message: "Error handling workers change", error });
    }
  }

  /**
   * vue-draggable の group.put ハンドラ
   * - 他グループからの受け入れ可否を判定する
   * - 作業員の重複配置を防止する
   * @param {*} to
   * @param {*} from
   * @param {*} dragEl
   * @returns {boolean} - 受け入れ可能な場合は true、拒否する場合は false
   */
  function handlePut(to, from, dragEl) {
    // 移動元のグループ名を取得
    const fromGroupName =
      from.el.getAttribute("data-group") || from.options?.group?.name;

    // 異なるグループ名からの移動は拒否
    if (fromGroupName !== props.groupName) return false;

    // ドラッグされた要素の情報を取得（存在しない場合は拒否）
    const element = dragEl.__draggable_context.element;
    if (!element) return false;

    // 要素が従業員でなければ無条件に許可
    if (element.isEmployee === false) return true;

    // workerId が存在しなければ拒否
    const workerId = element[props.itemKey];
    if (!workerId) return false;

    // --- 以下、要素が従業員の場合の処理 ---

    // 既に配置されている作業員であれば拒否して強調表示
    const isExist = internalSchedule.value.workers.some(
      (emp) => emp[props.itemKey] === workerId,
    );
    if (isExist) {
      highlightEmployee(workerId);
      return false;
    }

    // 配置されていなければ許可
    return true;
  }

  /*****************************************************************************
   * COMPUTED PROPERTIES
   *****************************************************************************/
  // draggable コンポーネントに渡す属性
  const attrs = Vue.computed(() => {
    return {
      modelValue: internalSchedule.value.workers,
      group: { name: props.groupName, put: handlePut },
      itemKey: props.itemKey,
      onChange: handleChange,
    };
  });

  // デフォルトスロットに渡すプロパティ
  const defaultSlotProps = Vue.computed(() => {
    return {
      highlight: true,
      schedule: internalSchedule.value,
      isDraggable: true,
    };
  });
  return { attrs, defaultSlotProps };
}
