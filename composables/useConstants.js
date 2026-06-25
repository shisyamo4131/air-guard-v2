import { computed } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import * as CONSTANTS from "@shisyamo4131/air-guard-v2-schemas/constants";

/**
 * デフォルトの定義（アプリケーション既定値）
 * - スキーマパッケージの定数に色設定を追加
 */
const DEFAULT_DEFINITIONS = {
  ARRANGEMENT_NOTIFICATION_STATUS: {
    ...CONSTANTS.ARRANGEMENT_NOTIFICATION_STATUS_VALUES,
  },
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
  DAY_OF_WEEK: {
    ...CONSTANTS.DAY_OF_WEEK_VALUES,
  },
  DAY_TYPE: {
    WEEKDAY: { ...CONSTANTS.DAY_TYPE_VALUES.WEEKDAY, color: "dark-grey" },
    SATURDAY: { ...CONSTANTS.DAY_TYPE_VALUES.SATURDAY, color: "light-blue" },
    SUNDAY: { ...CONSTANTS.DAY_TYPE_VALUES.SUNDAY, color: "red" },
    HOLIDAY: { ...CONSTANTS.DAY_TYPE_VALUES.HOLIDAY, color: "pink" },
  },
  EMPLOYMENT_STATUS: {
    ACTIVE: { ...CONSTANTS.EMPLOYMENT_STATUS_VALUES.ACTIVE, color: "primary" },
    RESIGNED: {
      ...CONSTANTS.EMPLOYMENT_STATUS_VALUES.RESIGNED,
      color: "warning",
    },
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
  INSURANCE_STATUS: {
    NOT_ENROLLED: {
      ...CONSTANTS.INSURANCE_STATUS_VALUES.NOT_ENROLLED,
      color: "error",
    },
    EXEMPT: {
      ...CONSTANTS.INSURANCE_STATUS_VALUES.EXEMPT,
      color: "info",
    },
    ENROLLED: {
      ...CONSTANTS.INSURANCE_STATUS_VALUES.ENROLLED,
      color: "success",
    },
  },
  PAYMENT_MONTH: {
    ...CONSTANTS.PAYMENT_MONTH_VALUES,
  },
  QUALIFIED_TYPE: {
    BASE: { value: "BASE", title: "基本", color: "grey" },
    QUALIFIED: { value: "QUALIFIED", title: "資格", color: "primary" },
  },
  SECURITY_TYPE: {
    ...CONSTANTS.SECURITY_TYPE_VALUES,
  },
  SHIFT_TYPE: {
    DAY: {
      ...CONSTANTS.SHIFT_TYPE_VALUES.DAY,
      color: "orange-darken-3",
      icon: "mdi-weather-sunny",
    },
    NIGHT: {
      ...CONSTANTS.SHIFT_TYPE_VALUES.NIGHT,
      color: "indigo",
      icon: "mdi-weather-night",
    },
  },
  SITE_STATUS: {
    ...CONSTANTS.SITE_STATUS_VALUES,
  },
  WEEK_COLORS: {
    background: [
      "rgba(255, 99, 132, 0.2)", // 月
      "rgba(76, 175, 80, 0.2)", // 火
      "rgba(255, 152, 0, 0.2)", // 水
      "rgba(244, 67, 54, 0.2)", // 木
      "rgba(33, 150, 243, 0.2)", // 金
      "rgba(156, 39, 176, 0.2)", // 土
      "rgba(255, 193, 7, 0.2)", // 日
    ],
    border: [
      "rgba(255, 99, 132, 1)",
      "rgba(76, 175, 80, 1)",
      "rgba(255, 152, 0, 1)",
      "rgba(244, 67, 54, 1)",
      "rgba(33, 150, 243, 1)",
      "rgba(156, 39, 176, 1)",
      "rgba(255, 193, 7, 1)",
    ],
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

  const ARRANGEMENT_NOTIFICATION_STATUS = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.ARRANGEMENT_NOTIFICATION_STATUS,
      "arrangementNotificationStatus",
      auth.company,
    ),
  );
  const BILLING_UNIT_TYPE = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.BILLING_UNIT_TYPE,
      "billingUnitType",
      auth.company,
    ),
  );

  const DAY_OF_WEEK = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.DAY_OF_WEEK,
      "dayOfWeek",
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

  const EMPLOYMENT_STATUS = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.EMPLOYMENT_STATUS,
      "employmentStatus",
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
  const INSURANCE_STATUS = computed(() => {
    return createConstantWithColors(
      DEFAULT_DEFINITIONS.INSURANCE_STATUS,
      "insuranceStatus",
      auth.company,
    );
  });
  const PAYMENT_MONTH = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.PAYMENT_MONTH,
      "paymentMonth",
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
  const SECURITY_TYPE = computed(() =>
    createConstantWithColors(
      DEFAULT_DEFINITIONS.SECURITY_TYPE,
      "securityType",
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
  const SITE_STATUS = computed(() => {
    return createConstantWithColors(
      DEFAULT_DEFINITIONS.SITE_STATUS,
      "siteStatus",
      auth.company,
    );
  });
  const WEEK_COLORS = computed(() => {
    return DEFAULT_DEFINITIONS.WEEK_COLORS;
  });

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
    ARRANGEMENT_NOTIFICATION_STATUS,
    BILLING_UNIT_TYPE,
    DAY_OF_WEEK,
    DAY_TYPE,
    EMPLOYMENT_STATUS,
    GENDER,
    INSURANCE_STATUS,
    PAYMENT_MONTH,
    QUALIFIED_TYPE,
    SECURITY_TYPE,
    SHIFT_TYPE,
    SITE_STATUS,
    WEEK_COLORS,
    toArray,
    DEFAULT_DEFINITIONS,
  };
}
