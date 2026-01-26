/*****************************************************************************
 * Tag コンポーネントで使用する props の定義
 *****************************************************************************/
export default {
  /**
   * タグの枠線を表示するかどうか
   * @type {String | Number | Boolean}
   * @default true
   * @description Vuetify の v-list-item コンポーネントの border prop に対応します。
   * @see https://vuetifyjs.com/en/api/v-list-item/#props-border
   */
  border: { type: [String, Number, Boolean], default: true },
  /**
   * タグを強調表示するかどうか
   * @type {Boolean}
   * @default false
   */
  highlight: { type: Boolean, default: false },
  /**
   * タグに表示するラベル文字列
   * @type {String | undefined}
   */
  label: { type: String, default: undefined },
  /**
   * タグが読み込み中状態かどうか
   * @type {Boolean}
   * @default false
   */
  loading: { type: Boolean, default: false },
  /**
   * タグに削除ボタンを表示するかどうか
   * @type {Boolean}
   * @default false
   */
  removable: { type: Boolean, default: false },
  /**
   * 削除ボタンのアイコン
   * @type {String}
   * @default 'mdi-close'
   */
  removeIcon: { type: String, default: "mdi-close" },
  /**
   * タグの角を丸くするかどうか
   * @type {String | Number | Boolean}
   * @default true
   * @description Vuetify の v-list-item コンポーネントの rounded prop に対応します。
   * @see https://vuetifyjs.com/en/api/v-list-item/#props-rounded
   */
  rounded: { type: [String, Number, Boolean], default: true },
  /**
   * タグにドラッグ可能アイコンを表示するかどうか
   * @type {Boolean}
   * @default false
   */
  showDraggableIcon: { type: Boolean, default: false },
  /**
   * タグのサイズ
   * @type {'small' | 'medium' | 'large'}
   * @default 'medium'
   * @description 'small', 'medium', 'large' のいずれかの値を取ります。
   * - 'small': 高さ 40px、タイトルクラス 'text-caption'
   * - 'medium': 高さ 48px、タイトルクラス 'text-subtitle-2'
   * - 'large': 高さ 56px、タイトルクラス 'text-body-1'
   * @validator 指定された値が 'small', 'medium', 'large' のいずれかであることを検証します。
   * @note 大文字小文字は区別されません。
   */
  size: {
    type: String,
    default: "medium",
    validator: (value) => {
      const values = ["small", "medium", "large"];
      const normalized = value.toLowerCase();
      return values.includes(normalized);
    },
  },
  /**
   * タグのバリアント
   * @type {'default' | 'success' | 'warning' | 'error' | 'disabled'}
   * @default 'default'
   * @description 'default', 'success', 'warning', 'error', 'disabled' のいずれかの値を取ります。
   * - 'default': 通常のタグ表示
   * - 'success': 成功状態を示すタグ表示
   * - 'warning': 警告状態を示すタグ表示
   * - 'error': エラー状態を示すタグ表示
   * - 'disabled': 無効状態を示すタグ表示
   * @validator 指定された値が 'default', 'success', 'warning', 'error', 'disabled' のいずれかであることを検証します。
   * @note 大文字小文字は区別されません。
   */
  variant: {
    type: String,
    default: "default",
    validator: (value) => {
      const values = ["default", "success", "warning", "error", "disabled"];
      const normalized = value.toLowerCase();
      return values.includes(normalized);
    },
  },
};
