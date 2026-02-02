/**
 * コンポーネントのデフォルト設定を管理するコンポーザブル
 *
 * @description
 * - Vuetify の defaults API を使用して、コンポーネントのデフォルト props を動的に変更します
 * - コンポーネント名を指定するだけで、適切な設定関数が自動的に呼び出されます
 *
 * @example
 * ```js
 * import { useComponentDefaults } from "@/composables/useComponentDefaults";
 *
 * const { set } = useComponentDefaults();
 *
 * // タグサイズを変更（Tag, WorkerTag, SiteOperationScheduleWorkerTag が対象）
 * set('Tag', 'LARGE');
 * set('WorkerTag', 'MEDIUM');
 * ```
 */
export function useComponentDefaults() {
  const { $vuetify } = useNuxtApp();

  /**
   * タグ系コンポーネントのデフォルトサイズを一括設定
   * - `Tag`, `WorkerTag`, `SiteOperationScheduleWorkerTag` に対応
   * @private
   * @param {string} size - タグサイズ（'SMALL', 'MEDIUM', 'LARGE' または 'small', 'medium', 'large'）
   */
  function setTagSize(size) {
    if (!size) {
      console.warn("[useComponentDefaults] Invalid size value:", size);
      return;
    }

    // 小文字に正規化
    const normalizedSize = size.toLowerCase();

    // バリデーション
    const validSizes = ["small", "medium", "large"];
    if (!validSizes.includes(normalizedSize)) {
      console.warn(
        `[useComponentDefaults] Invalid size value: ${size}. Must be one of: ${validSizes.join(", ")}`,
      );
      return;
    }

    // タグ系コンポーネントのデフォルトサイズを一括設定
    const tagComponents = [
      "Tag",
      "WorkerTag",
      "SiteOperationScheduleWorkerTag",
      // 今後追加するタグ系コンポーネントはここに追加
    ];

    tagComponents.forEach((component) => {
      if ($vuetify.defaults.value[component]) {
        $vuetify.defaults.value[component].size = normalizedSize;
      } else {
        // コンポーネントのデフォルト設定が存在しない場合は初期化
        $vuetify.defaults.value[component] = { size: normalizedSize };
      }
    });
  }

  /**
   * VTimePicker のデフォルト設定
   * @private
   * @param {number} minuteInterval - 許可する分の間隔（例: 15 → 0, 15, 30, 45 のみ許可）
   */
  function setVTimePickerDefaults(minuteInterval) {
    $vuetify.defaults.value.VTimePicker.allowedMinutes = (val) => {
      if (!minuteInterval) return true;
      return val % minuteInterval === 0;
    };
  }

  /**
   * VCalendar のデフォルト設定
   * @private
   * @param {number} firstDayOfWeek - 週の最初の曜日（0: 日曜日, 1: 月曜日）
   */
  function setVCalendarDefaults(firstDayOfWeek) {
    $vuetify.defaults.value.VCalendar.firstDayOfWeek = firstDayOfWeek ?? 0;
  }

  /**
   * コンポーネント別設定関数のマッピング
   * @private
   */
  const componentSetters = {
    Tag: setTagSize,
    WorkerTag: setTagSize,
    SiteOperationScheduleWorkerTag: setTagSize,
    VTimePicker: setVTimePickerDefaults,
    VCalendar: setVCalendarDefaults,
    // 今後追加するコンポーネントの設定関数をここに追加
    // 例: VBtn: setBtnDefaults,
  };

  /**
   * コンポーネントのデフォルト値を設定
   *
   * @param {string} componentName - コンポーネント名（例: 'Tag', 'WorkerTag', 'SiteOperationScheduleWorkerTag'）
   * @param {any} value - 設定する値（コンポーネントにより異なる）
   *
   * @example
   * ```js
   * const { set } = useComponentDefaults();
   *
   * // タグ系コンポーネントのサイズを設定
   * set('Tag', 'LARGE');
   * set('WorkerTag', 'SMALL');
   *
   * // Vuetify コンポーネントの設定
   * set('VTimePicker', 15); // 15分間隔
   * set('VCalendar', 1); // 週の開始を月曜日に
   * ```
   */
  function set(componentName, value) {
    const setter = componentSetters[componentName];

    if (!setter) {
      console.warn(
        `[useComponentDefaults] No setter found for component: ${componentName}`,
      );
      return;
    }

    setter(value);
  }

  return { set };
}
