/**
 * @file ./schemas/SiteOperationSchedule.js
 * @description 現場稼働予定情報クラス
 */
import { SiteOperationSchedule as BaseClass } from "air-guard-v2-schemas";

export default class SiteOperationSchedule extends BaseClass {
  /**
   * この現場稼働予定インスタンスを、Vuetify の VCalendar コンポーネントで
   * 表示可能なイベントオブジェクト形式に変換して返します。
   *
   * VCalendar でイベントを表示する際に必要な主要なプロパティ（タイトル、開始日時、
   * 終了日時、色など）を設定します。
   *
   * @returns {object} VCalendar イベントオブジェクト。以下のプロパティを含みます:
   *   @property {string} title - イベントのタイトル。`requiredPersonnel`（必要人数）と `workDescription`（作業内容）から生成されます。
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
    const title = `${this.requiredPersonnel} 名: ${this.workDescription || ""}`;
    return {
      title,
      start: this.dateAt,
      end: this.dateAt,
      color: this.shiftType === "day" ? "orange" : "indigo",
      item: this,
    };
  }
}
