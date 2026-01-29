/*****************************************************************************
 * SiteOperationScheduleWorkerTag で使用する props 定義
 * - `components/Worker/Tag/props` を拡張しています。
 *****************************************************************************/
import importedProps from "@/components/Worker/Tag/props";

// fetchEmployeeComposableとfetchOutsourcerComposableは親のimportedPropsに既に含まれているため、
// 追加のprops定義は不要
export default {
  ...importedProps,
};
