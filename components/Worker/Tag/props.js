/*****************************************************************************
 * WorkerTag で使用する props 定義
 * - `components/Tag/props` を拡張しています。
 *****************************************************************************/
import importedProps from "@/components/Tag/props";

// labelプロパティとloadingプロパティを除外
// - label: WorkerTagでは従業員情報から自動取得
// - loading: WorkerTagではuseFetchEmployeeのisLoadingから自動設定
const { label, loading, ...restProps } = importedProps;

export default {
  ...restProps,
  /**
   * 作業員ID
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
};
