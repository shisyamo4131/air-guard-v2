/*****************************************************************************
 * SiteOperationScheduleWorkerTag で使用する props 定義
 * - `components/Worker/Tag/props` を拡張しています。
 *****************************************************************************/
import importedProps from "@/components/Worker/Tag/props";

// startTime, endTime, isEmployee, id プロパティを除外
// - これらは worker オブジェクトから自動取得する。
const { startTime, endTime, isEmployee, id, ...rest } = importedProps;

export default {
  ...rest,
  disableEdit: { type: Boolean, default: false },
  disableNotification: { type: Boolean, default: false },
  editIcon: { type: String, default: "mdi-pencil" },
  hideEdit: { type: Boolean, default: false },
  hideNotification: { type: Boolean, default: false },
  notifications: { type: Object, default: null }, // 配置通知オブジェクトのマップ
  schedule: { type: Object, required: true }, // SiteOperationSchedule インスタンス
  worker: { type: Object, required: true }, // SiteOperationScheduleDetail インスタンス
};
