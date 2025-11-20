/***************************************************************************
 * SiteOperationSchedule Model (client) ver 1.0.0
 * @author shisyamo4131
 * ---------------------------------------------------------------------------
 * - Extends Operation class to represent a site operation schedule.
 * - Prevents updates or deletions if an associated OperationResult exists.
 * - Automatically assigns a display order based on existing documents during creation.
 * - Clears all notifications if related data have been changed during updates.
 * - Deletes all related notifications before deleting the schedule.
 * ---------------------------------------------------------------------------
 * [INHERIT]
 * @prop {string} siteId - Site document ID
 * @prop {Date} dateAt - Date of operation (placement date)
 * @prop {string} shiftType - `DAY` or `NIGHT`
 * @prop {string} startTime - Start time (HH:MM format)
 * @prop {string} endTime - End time (HH:MM format)
 * @prop {number} breakMinutes - Break time (minutes)
 * @prop {boolean} isStartNextDay - Next day start flag
 * - `true` if the actual work starts the day after the placement date `dateAt`
 * @prop {number} regulationWorkMinutes - Regulation work minutes
 * - Indicates the maximum working time treated as regular working hours.
 * - A new value will be synchronized to all `employees` and `outsourcers`.
 * @prop {number} requiredPersonnel - Required number of personnel
 * @prop {boolean} qualificationRequired - Qualification required flag
 * @prop {string} workDescription - Work description
 * @prop {string} remarks - Remarks
 * @prop {Array<SiteOperationScheduleDetail>} employees - Assigned employees
 * - Array of `SiteOperationScheduleDetail` instances representing assigned employees
 * @prop {Array<SiteOperationScheduleDetail>} outsourcers - Assigned outsourcers
 * - Array of `SiteOperationScheduleDetail` instances representing assigned outsourcers
 * @prop {string|null} operationResultId - Associated OperationResult document ID
 * - If an OperationResult has been created based on this schedule, this property
 *   holds the ID of that OperationResult document.
 * - If this property is set, the schedule cannot be updated or deleted.
 *   Conversely, if the associated OperationResult is deleted, this property can be set to null.
 * @prop {number} displayOrder - Display order
 * - Property to control the display order of schedules on the same date and shift type.
 * - Automatically assigned during creation based on existing documents.
 * ---------------------------------------------------------------------------
 * [INHERIT]
 * @computed {string} date - Date string in YYYY-MM-DD format based on `dateAt`
 * @computed {string} dayType - Day type based on `dateAt`
 * @computed {Date} startAt - Start date and time (Date object)
 * - Returns a Date object with `startTime` set based on `dateAt`.
 * - If `isStartNextDay` is true, add 1 day.
 * @computed {Date} endAt - End date and time (Date object)
 * - Returns a Date object with `endTime` set based on `dateAt`.
 * - If `isSpansNextDay` is true, add 1 day.
 * @computed {boolean} isSpansNextDay - Flag indicating whether the date spans from start date to end date
 * - `true` if `startTime` is later than `endTime`
 * @computed {Array<string>} employeeIds - Array of employee IDs from `employees`
 * @computed {Array<string>} outsourcerIds - Array of outsourcer IDs from `outsourcers`
 * @computed {number} employeesCount - Count of assigned employees
 * @computed {number} outsourcersCount - Count of assigned outsourcers (sum of amounts)
 * @computed {boolean} isPersonnelShortage - Indicates if there is a shortage of personnel
 * - `true` if the sum of `employeesCount` and `outsourcersCount` is less than `requiredPersonnel`
 * @computed {Array<OperationDetail>} workers - Combined array of `employees` and `outsourcers`
 * ---------------------------------------------------------------------------
 * [INHERIT]
 * @states isEmployeesChanged Indicates whether the employees have changed.
 * @states isOutsourcersChanged Indicates whether the outsourcers have changed.
 * @states addedWorkers An array of workers that have been added.
 * @states removedWorkers An array of workers that have been removed.
 * @states updatedWorkers An array of workers that have been updated.
 * @states isEditable Indicates whether the instance is editable.
 * @states isNotificatedAllWorkers Indicates whether all workers have been notified.
 * ---------------------------------------------------------------------------
 * [INHERIT]
 * @methods addWorker Adds a new worker (employee or outsourcer).
 * @methods moveWorker Changes the position of a worker (employee or outsourcer).
 * @methods removeWorker Removes a worker (employee or outsourcer).
 *
 * [ADDED]
 * @methods duplicate Duplicates the schedule for specified dates.
 * @methods notify Creates arrangement notifications for workers who have not been notified yet.
 * @methods syncToOperationResult Creates an OperationResult document based on the current schedule.
 * @methods toEvent Converts the schedule to an event object compatible with Vuetify's VCalendar component.
 ***************************************************************************/
import { SiteOperationSchedule as BaseClass } from "@shisyamo4131/air-guard-v2-schemas";
import { ContextualError } from "@shisyamo4131/air-guard-v2-schemas/utils";
import {
  ArrangementNotification,
  OperationResult,
  SiteOperationScheduleDetail,
  Agreement,
} from "@/schemas";
import dayjs from "dayjs";
import { runTransaction } from "firebase/firestore";

export default class SiteOperationSchedule extends BaseClass {
  /***************************************************************************
   * METHODS
   ***************************************************************************/
  /**
   * 現場稼働予定ドキュメントを指定された日付分複製します。
   * - 複製された各ドキュメントは新規作成され、元のドキュメントとは別のIDを持ちます。
   * - 複製先の日付が元のドキュメントの日付と同じ場合、その日付分の複製は行われません。
   * @param {Array<Date|string>} dates - 複製先の日付の配列。Dateオブジェクトまたは日付文字列で指定します。
   * @returns {Promise<Array<SiteOperationSchedule>>}
   */
  async duplicate(dates = []) {
    if (!this.docId) {
      throw new Error("不正な処理です。作成前のスケジュールは複製できません。");
    }
    if (!Array.isArray(dates) || dates.length === 0) {
      throw new Error("複製する日付を配列で指定してください。");
    }
    if (dates.some((d) => !(d instanceof Date) && typeof d !== "string")) {
      throw new TypeError(
        "日付の指定が無効です。Dateオブジェクトか文字列で指定してください。"
      );
    }
    if (dates.length > 20) {
      throw new Error("一度に複製できるスケジュールは最大20件です。");
    }
    try {
      // 日付が Date オブジェクトであれば日付文字列に変換しつつ、元のスケジュールと同じ日付は除外し、
      // 加えて重複も除外する。
      const targetDates = dates
        .map((date) => {
          if (date instanceof Date) return dayjs(date).format("YYYY-MM-DD");
          return date;
        })
        .filter((date) => date !== this.date)
        .reduce((unique, date) => {
          if (!unique.includes(date)) unique.push(date);
          return unique;
        }, []);

      // 複製するための現場稼働予定インスタンスを生成
      const newSchedules = targetDates.map((date) => {
        const instance = this.clone();
        instance.docId = "";
        instance.dateAt = new Date(date);
        instance.operationResultId = null;
        return instance;
      });

      // トランザクションで一括作成
      const firestore = this.constructor.getAdapter().firestore;
      await runTransaction(firestore, async (transaction) => {
        await Promise.all(
          newSchedules.map((schedule) => schedule.create({ transaction }))
        );
      });

      return newSchedules;
    } catch (error) {
      throw new ContextualError("現場稼働予定の複製処理に失敗しました。", {
        method: "duplicate",
        className: "SiteOperationSchedule",
        arguments: { dates },
        state: this.toObject(),
        error,
      });
    }
  }

  /**
   * 配置通知を作成します。
   * - 現在配置通知がなされてない作業員に対してのみ配置通知ドキュメントを作成します。
   * - 全作業員の配置通知フラグが true に更新されます。
   * @returns {Promise<void>}
   */
  async notify() {
    try {
      // 未通知である作業員を抽出
      const targetWorkers = this.workers.filter((w) => !w.hasNotification);

      // 配置通知ドキュメントを作成するためのインスタンス配列を生成
      const notifications = targetWorkers.map((worker) => {
        return new ArrangementNotification({
          ...worker,
          actualStartTime: worker.startTime,
          actualEndTime: worker.endTime,
          actualBreakMinutes: worker.breakMinutes,
        });
      });

      // 配置通知インスタンスがなければ処理終了
      if (notifications.length === 0) {
        return;
      }

      // 従業員、外注先の通知済みフラグを更新
      this.employees.forEach((emp) => (emp.hasNotification = true));
      this.outsourcers.forEach((out) => (out.hasNotification = true));

      // トランザクションで配置通知ドキュメントを一括作成し、作成済みフラグを更新
      const firestore = this.constructor.getAdapter().firestore;
      await runTransaction(firestore, async (transaction) => {
        await Promise.all([
          ...notifications.map((n) => n.create({ transaction })),
          this.update({ transaction }),
        ]);
      });
    } catch (error) {
      this.undo();
      throw new ContextualError(
        `配置通知作成処理に失敗しました。: ${error.message}`,
        {
          method: "notify",
          className: "SiteOperationSchedule",
          arguments: {},
          state: this.toObject(),
        }
      );
    }
  }

  /**
   * 現在のインスタンスから稼働実績ドキュメントを作成します。
   * - 稼働実績ドキュメントの ID は現場稼働予定ドキュメントの ID と同一になります。
   *   既に存在する場合は上書きされます。
   * - 現場稼働予定ドキュメントの `operationResultId` プロパティに
   *   作成された稼働実績ドキュメントの ID が設定されます。（当該ドキュメント ID と同一）
   * @param {Object} agreement - 取極め情報オブジェクト。稼働実績ドキュメントの生成に必要なプロパティを含みます。
   */
  async syncToOperationResult(agreement, notifications = {}) {
    if (!this.docId) {
      throw new Error(
        "不正な処理です。作成前の現場稼働予定から稼働実績を作成することはできません。"
      );
    }

    if (!notifications) {
      throw new Error("配置通知の指定が必要です。");
    }
    const converter = (prop) => {
      return this[prop].map((w) => {
        const notification = notifications[w.notificationKey];
        if (!notification) return w;
        const {
          actualStartTime: startTime,
          actualEndTime: endTime,
          actualBreakMinutes: breakMinutes,
          actualIsStartNextDay: isStartNextDay,
        } = notification;
        return new SiteOperationScheduleDetail({
          ...w.toObject(),
          startTime,
          endTime,
          breakMinutes,
          isStartNextDay,
        });
      });
    };
    const employees = converter("employees");
    const outsourcers = converter("outsourcers");
    try {
      // Create OperationResult instance based on the current SiteOperationSchedule
      const operationResult = new OperationResult({
        ...this.toObject(),
        employees,
        outsourcers,
        agreement: agreement || null,
        siteOperationScheduleId: this.docId,
      });
      operationResult.refreshBillingDateAt();
      const firestore = this.constructor.getAdapter().firestore;
      await runTransaction(firestore, async (transaction) => {
        const docRef = await operationResult.create({
          docId: this.docId,
          transaction,
        });
        this.operationResultId = docRef.id;
        await this.update({ transaction });
      });
    } catch (error) {
      throw new ContextualError(error.message, {
        method: "syncToOperationResult()",
        className: "SiteOperationSchedule",
        arguments: { agreement },
        state: this.toObject(),
      });
    }
  }

  /**
   * この現場稼働予定インスタンスを、Vuetify の VCalendar コンポーネントで
   * 表示可能なイベントオブジェクト形式に変換して返します。
   *
   * VCalendar でイベントを表示する際に必要な主要なプロパティ（タイトル、開始日時、
   * 終了日時、色など）を設定します。
   *
   * @returns {object} VCalendar イベントオブジェクト。以下のプロパティを含みます:
   *   @property {string} name - イベントのタイトル。`requiredPersonnel`（必要人数）と `workDescription`（作業内容）から生成されます。
   *   @property {Date} start - イベントの開始日時。インスタンスの `startAt` プロパティ（Dateオブジェクト）がそのまま使用されます。
   *   @property {Date} end - イベントの終了日時。
   *     **注意点:** 本来はインスタンスの `endAt` プロパティを使用すべきですが、
   *     VCalendar の仕様（または過去のバージョンでの挙動）により、日をまたぐイベントを
   *     `endAt` で正確に指定すると、カレンダー上で複数の日にまたがって
   *     同一イベントが複数描画されてしまう問題がありました。
   *     これを回避するため、現状では `startAt` と同じ値を設定し、
   *     イベントが開始日のみに単一のイベントとして表示されるようにしています。
   *     もし将来的に日をまたぐ期間を正確にカレンダー上で表現する必要が生じた場合は、
   *     VCalendar のバージョンアップや設定変更、またはこの `end` プロパティの
   *     扱いについて再検討が必要です。
   *   @property {string} color - イベントの表示色。`shiftType` プロパティの値に応じて、
   *     日勤 (`day`) の場合は 'orange'、夜勤 (`night`) の場合は 'navy' が設定されます。
   *   @property {SiteOperationSchedule} item - この `SiteOperationSchedule` インスタンス自身への参照です。
   *     カレンダー上でイベントがクリックされた際などに、元のスケジュールデータへ
   *     アクセスするために利用できます。
   */
  toEvent() {
    const name = `${this.requiredPersonnel} 名: ${
      this.workDescription || "通常警備"
    }`;
    const color = !this.isEditable
      ? "grey"
      : this.shiftType === "DAY"
      ? "orange"
      : "indigo";
    return {
      name,
      start: this.dateAt,
      end: this.dateAt,
      color,
      item: this,
    };
  }
}
