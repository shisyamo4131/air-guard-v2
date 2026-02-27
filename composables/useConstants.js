import { computed } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import * as CONSTANTS from "@shisyamo4131/air-guard-v2-schemas/constants";

/**
 * デフォルトの定義（アプリケーション既定値）
 * - スキーマパッケージの定数に色設定を追加
 */
const DEFAULT_DEFINITIONS = {
  BILLING_UNIT_TYPE: {
    PER_DAY: {
      ...CONSTANTS.BILLING_UNIT_TYPE_VALUES.PER_DAY,
      color: undefined,
    },
    PER_HOUR: {
      ...CONSTANTS.BILLING_UNIT_TYPE_VALUES.PER_HOUR,
      color: undefined,
    },
  },
  DAY_TYPE: {
    WEEKDAY: { ...CONSTANTS.DAY_TYPE_VALUES.WEEKDAY, color: "dark-grey" },
    SATURDAY: { ...CONSTANTS.DAY_TYPE_VALUES.SATURDAY, color: "light-blue" },
    SUNDAY: { ...CONSTANTS.DAY_TYPE_VALUES.SUNDAY, color: "red" },
    HOLIDAY: { ...CONSTANTS.DAY_TYPE_VALUES.HOLIDAY, color: "pink" },
  },
  GENDER: {
    MALE: {
      ...CONSTANTS.GENDER_VALUES.MALE,
      color: "blue",
      icon: "mdi-gender-male",
    },
    FEMALE: {
      ...CONSTANTS.GENDER_VALUES.FEMALE,
      color: "pink",
      icon: "mdi-gender-female",
    },
  },
  SHIFT_TYPE: {
    DAY: { ...CONSTANTS.SHIFT_TYPE_VALUES.DAY, color: "deep-orange" },
    NIGHT: { ...CONSTANTS.SHIFT_TYPE_VALUES.NIGHT, color: "indigo" },
  },
  QUALIFIED_TYPE: {
    BASE: { value: "BASE", title: "基本", color: "grey" },
    QUALIFIED: { value: "QUALIFIED", title: "資格", color: "primary" },
  },
};

/**
 * 会社設定を反映した定数を生成
 * @param {Object} defaultDef - デフォルト定義
 * @param {string} categoryKey - カテゴリーキー（例: "dayType", "shiftType"）
 * @param {Object} company - 会社インスタンス
 * @returns {Object} 会社設定を反映した定数
 */
function createConstantWithColors(defaultDef, categoryKey, company) {
  return Object.keys(defaultDef).reduce((acc, key) => {
    const defaultValue = defaultDef[key];

    // 会社設定から色を取得
    const colorDef = company?.colorDefinitions?.[categoryKey]?.[key];

    // 文字列の場合とオブジェクトの場合の両方に対応
    const customColor =
      typeof colorDef === "string" ? colorDef : colorDef?.color;
    const color = customColor || defaultValue.color;

    acc[key] = {
      ...defaultValue,
      color,
    };
    return acc;
  }, {});
}

/**
 * 定数と色設定を管理する Composable
 */
export function useConstants() {
  const auth = useAuthStore();

  const BILLING_UNIT_TYPE = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.BILLING_UNIT_TYPE,
      "billingUnitType",
      auth.company,
    ),
  );

  const DAY_TYPE = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.DAY_TYPE,
      "dayType",
      auth.company,
    ),
  );

  const GENDER = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.GENDER,
      "gender",
      auth.company,
    ),
  );
  const SHIFT_TYPE = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.SHIFT_TYPE,
      "shiftType",
      auth.company,
    ),
  );

  const QUALIFIED_TYPE = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.QUALIFIED_TYPE,
      "qualifiedType",
      auth.company,
    ),
  );

  /**
   * 定数オブジェクトを配列に変換
   * @param {Object} constantObject - 定数オブジェクト（例: DAY_TYPE.value）
   * @returns {Array} { title, value } の配列
   */
  function toArray(constantObject) {
    return Object.keys(constantObject).map((key) => ({
      title: constantObject[key].title,
      value: constantObject[key].value,
    }));
  }

  return {
    BILLING_UNIT_TYPE,
    DAY_TYPE,
    GENDER,
    SHIFT_TYPE,
    QUALIFIED_TYPE,
    toArray,
    DEFAULT_DEFINITIONS,
  };
}
