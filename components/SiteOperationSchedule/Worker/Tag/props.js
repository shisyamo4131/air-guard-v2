/*****************************************************************************
 * SiteOperationScheduleWorkerTag で使用する props 定義
 * - `components/Worker/Tag/props` を拡張しています。
 *****************************************************************************/
import importedProps from "@/components/Worker/Tag/props";

const { startTime, endTime, isEmployee, id, ...rest } = importedProps;

export default {
  ...rest,
  worker: { type: Object, required: true },
};
