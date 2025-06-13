/**
 * @file ./composables/useLocalizedConstants.js
 * @description ローカライズされた定数を提供するためのコンポーザブルです。
 *              現在は曜日データのみを扱いますが、他の定数にも拡張可能です。
 */
import { ref, computed } from "vue";
import { DAY_OF_WEEK_DATA } from "~/constants";

export function useLocalizedConstants() {
  // アプリケーションの現在のロケールを管理します。
  // 本格的な多言語対応では、vue-i18nなどのライブラリと連携することを推奨します。
  const currentLocale = ref("ja"); // 例: 'ja', 'en'

  /**
   * 指定されたロケールとフォーマットで曜日のリストを取得します。
   * @param {object} options
   * @param {string} [options.locale=currentLocale.value] - ロケール ('ja', 'en' など)。
   * @param {'full' | 'short'} [options.format='full'] - 表示フォーマット。
   * @returns {Array<{value: number, title: string}>} v-selectなどで使いやすい形式の配列。
   */
  const getFormattedDaysOfWeek = (options = {}) => {
    const locale = options.locale || currentLocale.value;
    const format = options.format || "full";

    return DAY_OF_WEEK_DATA.map((day) => {
      const langData = day[locale] || day.ja; // 指定ロケールがなければ日本語にフォールバック
      const title = langData[format] || langData.full; // 指定フォーマットがなければフル形式にフォールバック
      return {
        value: day.value,
        title: title, // v-selectが期待するキー
      };
    });
  };

  // pages/collection-routes/[id].vue で使用する形式の曜日リスト
  const dayOfWeeksForSelect = computed(() =>
    getFormattedDaysOfWeek({ locale: "ja", format: "full" })
  );

  return {
    getFormattedDaysOfWeek,
    dayOfWeeksForSelect, // 現在のコンポーネント用
    // currentLocale, // 必要に応じてロケールを外部から変更可能にする
    // setLocale: (newLocale) => { currentLocale.value = newLocale; },
  };
}
