/**
 * @file ./schemas/SiteOperationSchedule.js
 * @description 現場稼働予定情報クラス
 */
import { SiteOperationSchedule as BaseClass } from "air-guard-v2-schemas";

export default class SiteOperationSchedule extends BaseClass {
  /**
   * Vuetify の VCalendar に読み込ませるための event オブジェクトを返します。
   * @returns
   */
  toEvent() {
    return {
      title: this.requiredPersonnel,
      start: this.startAt,
      end: this.startAt, // endAt を使うと日をまたがった場合にカレンダー上で複数のイベントが描画されてしまう。
      color: this.shiftType === "day" ? "orange" : "navy",
      item: this,
    };
  }
}
