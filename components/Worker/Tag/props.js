/*****************************************************************************
 * WorkerTag で使用する props 定義
 * - `components/Tag/props` を拡張しています。
 *****************************************************************************/
import importedProps from "@/components/Tag/props";

export default {
  ...importedProps,
  /** End time of the worker's shift */
  endTime: { type: String, default: undefined },
  /** Start time of the worker's shift */
  startTime: { type: String, default: undefined },
};
