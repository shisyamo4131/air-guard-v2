import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/*****************************************************************************
 * @file ./composables/domain/siteOperationSchedule/useSiteOperationScheduleActions.js
 * @description
 * - 現場稼働予定の更新・通知作成・複数スケジュールの一括更新を担当する composable です。
 *****************************************************************************/
export function useSiteOperationScheduleActions() {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const auth = useAuthStore();
  const loadings = useLoadingsStore();
  const logger = useLogger("useSiteOperationScheduleActions", useErrorsStore());

  /*****************************************************************************
   * METHODS
   *****************************************************************************/
  /**
   * 引数で指定されたスケジュールの配置通知を作成します。
   * - データ更新ではなく通知作成の UI 操作だけを担当します。
   * @param {*} schedule - 配置通知を作成するスケジュールオブジェクト
   * @returns {Promise<void>}
   */
  const notify = async (schedule) => {
    const key = loadings.add(`Creating notifications`);
    try {
      await schedule.notify();
    } catch (error) {
      logger.error({ message: "Failed to create notification", error });
    } finally {
      loadings.remove(key);
    }
  };

  /**
   * 引数で受け取ったスケジュールを更新します。
   * - `SiteOperationScheduleCard` の `update:schedule` イベントで使用される、
   *   作業員の追加・削除や順序変更をデータベースに反映するためのものです。
   * Note: 複数スケジュールの更新が必要な場合は、updateSchedules を使用します。
   *       updateSchedules を個別に呼び出すよりも効率的です。
   * - 変更前後の workers は開発時のみ確認用に出力します。
   * @param {SiteOperationSchedule} schedule - 更新するスケジュールオブジェクト
   */
  const updateSchedule = async (schedule) => {
    // 開発者の場合、更新前後の作業員IDリストをコンソールに表示
    if (auth.isDeveloper) {
      const before = schedule._beforeData.workers.map((w) => w.workerId);
      const after = schedule.workers.map((w) => w.workerId);
      console.table({ before, after });
    }
    try {
      await schedule.update();
    } catch (error) {
      logger.error({ message: "Failed to update schedule", error });
    }
  };

  /**
   * 引数で受け取った複数のスケジュールを一括で更新します。
   * - `DraggableOperationSchedules` の `update:schedules` イベントで使用される、
   *   複数スケジュールの更新をデータベースに反映するためのものです。
   *   `displayOrder` の変更を反映することを目的としています。
   * - トランザクションを使用して一括更新を行います。
   * - 空配列なら呼び出されても実質的に処理は走りません。
   * @param {Array<SiteOperationSchedule>} schedules
   */
  const updateSchedules = async (schedules) => {
    try {
      await SiteOperationSchedule.runTransaction(async (transaction) => {
        const promises = schedules.map((schedule) =>
          schedule.update({ transaction }),
        );
        await Promise.all(promises);
      });
    } catch (error) {
      logger.error({ message: "Failed to update schedules", error });
    }
  };

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    notify,
    updateSchedule,
    updateSchedules,
  };
}
