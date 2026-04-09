/*****************************************************************************
 * @file ./components/Agreements/Viewer/useIndex.js
 * @description AgreementsViewer 専用コンポーザブル
 *****************************************************************************/
import dayjs from "dayjs";
import * as Vue from "vue";
import { useLogger } from "@/composables/useLogger.js";
import { useErrorsStore } from "@/stores/useErrorsStore.js";
import {
  SHIFT_TYPE_VALUES,
  SHIFT_TYPE_OPTIONS,
} from "@shisyamo4131/air-guard-v2-schemas/constants";

/**
 * @param {import('vue').Ref<Array>} agreements - 取極め情報の配列を保持するリアクティブな参照。各要素は取極め情報オブジェクトであると想定される。
 * @param {import('vue').Ref<string>|string} shiftType - 勤務区分を保持するリアクティブな参照または文字列。有効な値は `SHIFT_TYPE_VALUES` のいずれかであると想定される。
 * @return {Object} - AgreementsViewer コンポーネントで取極め情報の表示に使用される状態と関数を含むオブジェクト。
 */
export function useIndex(
  agreements = Vue.ref([]),
  shiftType = SHIFT_TYPE_OPTIONS[0].value,
) {
  /*****************************************************************************
   * SETUP STORES & COMPOSABLES
   *****************************************************************************/
  const logger = useLogger("useAgreementsViewer", useErrorsStore());

  /*****************************************************************************
   * STATES
   *****************************************************************************/
  const internalAgreements = Vue.ref([]); // 内部で管理する取極め情報配列
  const internalShiftType = Vue.ref(SHIFT_TYPE_OPTIONS[0].value); // 内部で管理する勤務区分
  const currentIndex = Vue.ref(0); // 現在表示されている取極め情報のインデックス

  /*****************************************************************************
   * WATCHERS
   *****************************************************************************/
  /**
   * `agreements`, `shiftType` を監視し、`internalAgreements` と `internalShiftType` に値を同期する。
   * - 扱うデータを保証するため、`internalAgreements` にセットする取極め情報配列は
   *   `shiftType` で絞り込む。
   */
  Vue.watchEffect(() => {
    /** VALIDATION */
    // `shiftType` が有効な値でなければ警告を出力し、`DAY` (SHIFT_TYPE_OPTIONS の最初の要素) を受け取ったものとして以降の処理を行う。
    let providedShiftType = Vue.unref(shiftType);
    if (!Object.keys(SHIFT_TYPE_VALUES).includes(providedShiftType)) {
      logger.warn({
        message: `Invalid 'shiftType' was provided. shiftType: ${providedShiftType}. Composable uses a value of ${SHIFT_TYPE_OPTIONS[0].value} as 'shiftType' instead.`,
      });
      providedShiftType = SHIFT_TYPE_OPTIONS[0].value;
    }
    // `agreements` が配列でなければ警告を出力し、空配列を受け取ったものとして以降の処理を行う。
    let providedAgreements = Vue.unref(agreements);
    if (!Array.isArray(providedAgreements)) {
      logger.warn({
        message: `Invalid 'agreements' was provided. Expected an array but received: ${providedAgreements}. Composable uses an empty array instead.`,
      });
      providedAgreements = [];
    }

    // 内部状態を更新
    internalShiftType.value = providedShiftType;
    internalAgreements.value = providedAgreements
      .filter((agreement) => {
        return agreement.shiftType === internalShiftType.value;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  /*****************************************************************************
   * COMPUTED STATES
   *****************************************************************************/
  /**
   * 現在有効な取極め情報のインデックスを返す computed プロパティ
   * - `internalAgreements` の中で、今日の日付以下のもののうち、最も新しいもののインデックスを返す。
   * - 例えば、`internalAgreements` が以下のような配列で、今日の日付が "2024-06-15" の場合:
   *   [
   *    { date: "2024-06-10", shiftType: "DAY", ... },
   *    { date: "2024-06-12", shiftType: "DAY", ... },
   *    { date: "2024-06-16", shiftType: "DAY", ... },
   *   ]
   *   返されるインデックスは 1 となる。
   * - 有効な取極め情報が存在しない場合は -1 を返す。
   * @returns {number} - 現在有効な取極め情報のインデックス。存在しない場合は -1。
   */
  const validIndex = Vue.computed(() => {
    const today = dayjs().tz("Asia/Tokyo").format("YYYY-MM-DD");
    const index = [...internalAgreements.value].findLastIndex(
      ({ date }) => date <= today,
    );
    return index;
  });

  /**
   * 現在有効な取極め情報を返す computed プロパティ
   * - `validIndex` で示されるインデックスに対応する取極め情報を `internalAgreements` から返す。
   * - 有効な取極め情報が存在しない場合は null を返す。
   * @returns {Object|null} - 現在有効な取極め情報オブジェクト。存在しない場合は null。
   */
  const validAgreement = Vue.computed(() => {
    const index = validIndex.value;
    if (index === -1) return null;
    return internalAgreements.value[index];
  });

  /**
   * 現在のインデックスにある取極め情報を返す computed プロパティ
   * - `currentIndex` で示されるインデックスに対応する取極め情報を `internalAgreements` から返す。
   * - `internalAgreements` が空の場合は null を返す。
   * @returns {Object|null} - 現在のインデックスにある取極め情報オブジェクト。`internalAgreements` が空の場合は null。
   */
  const currentAgreement = Vue.computed(() => {
    if (internalAgreements.value.length === 0) return null;
    return internalAgreements.value[currentIndex.value];
  });

  /*****************************************************************************
   * FUNCTIONS
   *****************************************************************************/
  /**
   * インデックスを次に進めます。
   * - `currentIndex` を 1 増やします。ただし、`currentIndex` が `internalAgreements` の最後のインデックスに達している場合は、0 にリセットします。
   * @returns {void}
   */
  function next() {
    if (currentIndex.value < internalAgreements.value.length - 1) {
      currentIndex.value += 1;
    } else {
      currentIndex.value = 0;
    }
  }

  /**
   * インデックスを前に戻します。
   * - `currentIndex` を 1 減らします。ただし、`currentIndex` が 0 の場合は、`internalAgreements` の最後のインデックスに設定します。
   * @returns {void}
   */
  function prev() {
    if (currentIndex.value > 0) {
      currentIndex.value -= 1;
    } else {
      currentIndex.value = internalAgreements.value.length - 1;
    }
  }

  /**
   * インデックスを初期化します。
   * - `validIndex` が -1 であれば、`currentIndex` を 0 に設定します。そうでなければ、`currentIndex` を `validIndex` の値に設定します。
   * @returns {void}
   */
  function init() {
    if (validIndex.value === -1) {
      currentIndex.value = 0;
    } else {
      currentIndex.value = validIndex.value;
    }
  }

  /**
   * 指定されたインデックスに移動します。
   * - `index` が `internalAgreements` の範囲外の場合は警告を出力し、移動しません。
   * @param {number} index - 移動先のインデックス。
   * @returns {void}
   */
  function goToIndex(index = 0) {
    if (index < 0 || index >= internalAgreements.value.length) {
      logger.warn({
        message: `Invalid index provided to goTo function. index: ${index}. Index should be between 0 and ${internalAgreements.value.length - 1}.`,
      });
      return;
    }
    currentIndex.value = index;
  }

  /**
   * 指定された取極め情報に移動します。
   * - `agreement` が `internalAgreements` に存在する場合、そのインデックスに移動します。
   * - 存在しない場合は警告を出力します。
   * @param {Object} agreement - 移動先の取極め情報オブジェクト。
   * @returns {void}
   */
  function goToAgreement(agreement) {
    const index = internalAgreements.value.findIndex(
      ({ key }) => key === agreement.key,
    );
    if (index === -1) {
      logger.warn({
        message: `Provided agreement is not found in internalAgreements. agreement: ${JSON.stringify(agreement)}.`,
      });
      return;
    }
    goToIndex(index);
  }

  /**
   * 指定されたインデックスまたは取極め情報に移動します。
   * - `indexOrAgreement` が数値の場合は `goToIndex` を呼び出します。
   * - `indexOrAgreement` がオブジェクトの場合は `goToAgreement` を呼び出します。
   * - それ以外の場合は警告を出力します。
   * @param {number|Object} indexOrAgreement - 移動先のインデックスまたは取極め情報オブジェクト。
   * @returns {void}
   */
  function goTo(indexOrAgreement = 0) {
    if (typeof indexOrAgreement === "number") {
      goToIndex(indexOrAgreement);
    } else if (
      typeof indexOrAgreement === "object" &&
      indexOrAgreement !== null
    ) {
      goToAgreement(indexOrAgreement);
    } else {
      logger.warn({
        message: `Invalid argument provided to goTo function. indexOrAgreement: ${JSON.stringify(indexOrAgreement)}.`,
      });
    }
  }

  init();

  /*****************************************************************************
   * RETURN
   *****************************************************************************/
  return {
    agreements: Vue.computed(() => internalAgreements.value),
    shiftType: Vue.computed(() => internalShiftType.value),
    currentAgreement,
    currentIndex: Vue.computed({
      get: () => currentIndex.value,
      set: (v) => goTo(v),
    }),
    validAgreement,
    validIndex,
    next,
    prev,
    init,
    goTo,
  };
}
