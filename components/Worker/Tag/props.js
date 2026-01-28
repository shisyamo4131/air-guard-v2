/*****************************************************************************
 * WorkerTag で使用する props 定義
 * - `components/Tag/props` を拡張しています。
 *****************************************************************************/
import importedProps from "@/components/Tag/props";

// labelプロパティとloadingプロパティを除外
// - label: WorkerTagでは従業員/外注先情報から自動取得
// - loading: WorkerTagではuseFetchEmployee/useFetchOutsourcerのisLoadingから自動設定
const { label, loading, ...restProps } = importedProps;

export default {
  ...restProps,
  /**
   * 従業員かどうか (true: 従業員、false: 外注先)
   */
  isEmployee: {
    type: Boolean,
    required: true,
  },
  /**
   * 作業員ID (従業員IDまたは外注先ID)
   */
  workerId: {
    type: String,
    required: true,
  },
  /**
   * useFetchEmployee コンポーザブルのインスタンス
   * 親コンポーネントから渡される場合は、キャッシュを共有できます。
   * 指定されない場合は、コンポーネント内部で新規インスタンスを作成します。
   */
  fetchEmployeeComposable: {
    type: Object,
    default: undefined,
  },
  /**
   * useFetchOutsourcer コンポーザブルのインスタンス
   * 親コンポーネントから渡される場合は、キャッシュを共有できます。
   * 指定されない場合は、コンポーネント内部で新規インスタンスを作成します。
   */
  fetchOutsourcerComposable: {
    type: Object,
    default: undefined,
  },
  /** End time of the site operation schedule worker's shift */
  endTime: { type: String, default: undefined },
  /** Whether to hide the time display */
  hideTime: { type: Boolean, default: false },
  /** Start time of the site operation schedule worker's shift */
  startTime: { type: String, default: undefined },
};
