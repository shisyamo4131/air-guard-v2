import dayjs from "dayjs";
import { useLoadingsStore } from "@/stores/useLoadingsStore";
import { useLogger } from "@/composables/useLogger";
import { useErrorsStore } from "@/stores/useErrorsStore";
import { SiteOperationSchedule } from "@/schemas";
import { useAuthStore } from "@/stores/useAuthStore";

/*****************************************************************************
 * @file ./composables/application/siteOperationSchedule/useSiteOperationScheduleActions.js
 * @description
 * - 現場稼働予定の更新・通知作成・複数スケジュールの一括更新を、
 *   画面操作から利用しやすい形で提供する application composable です。
 * - Firestore への具体的な保存処理は SiteOperationSchedule インスタンスに委譲し、
 *   この composable は loading / error handling / 開発時ログを含む操作手順を担当します。
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
   * 現場稼働予定の配列を受け取り、siteId, shiftType, dateAt, displayOrder を `options` で
   * 指定された値に更新して返します。
   * @param {Array<SiteOperationSchedule>} schedules - 正規化するスケジュール配列
   * @param {{ date: string, siteId: string, shiftType: string }} options - 正規化に必要なオプション
   * @returns {Array<SiteOperationSchedule>} 正規化されたスケジュール配列
   * @throws {Error} options に date, siteId, shiftType が含まれていない場合にスローされます。
   */
  function normalizeSchedules(schedules, options = {}) {
    const { date, siteId, shiftType } = options;
    if (!date || !siteId || !shiftType) {
      throw new Error("Missing required options: date, siteId, shiftType");
    }
    const dateAt = dayjs.tz(date, "Asia/Tokyo").startOf("day").toDate();
    return schedules.map((schedule, index) => {
      schedule.siteId = siteId;
      schedule.shiftType = shiftType;
      schedule.dateAt = dateAt;
      schedule.displayOrder = index;
      return schedule;
    });
  }
  /**
   * 引数で受け取った複数の現場稼働予定を一括でデータベースに更新します。
   * - `displayOrder` が配列の要素順で更新されます。
   * - `siteId`, `shiftType`, `dateAt` は `options` で指定された値に更新されます。
   * - トランザクションを使用して一括更新を行います。
   * - 空配列の場合、呼び出されても実質的に処理は走りません。
   * @param {Array<SiteOperationSchedule>} schedules
   * @param {{ date: string, siteId: string, shiftType: string }} options - 正規化に必要なオプション
   * @returns {Promise<void>}
   */
  const updateSchedules = async (schedules, options = {}) => {
    try {
      const normalizedSchedules = normalizeSchedules(schedules, options);
      await SiteOperationSchedule.runTransaction(async (transaction) => {
        const promises = normalizedSchedules.map((schedule) =>
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
