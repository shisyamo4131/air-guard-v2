<!-- filepath: c:\Users\seven\projects\AirGuard\air-guard-v2\pages\round-setting-test.vue -->
<template>
  <v-container>
    <v-card>
      <v-card-title>RoundSetting 包括的テスト</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12">
            <v-btn
              @click="runAllTests"
              color="primary"
              size="large"
              class="mr-2"
            >
              全テスト実行
            </v-btn>
            <v-btn @click="runBasicTests" color="secondary" class="mr-2">
              基本テストのみ
            </v-btn>
            <v-btn @click="runAdvancedTests" color="info">
              詳細テストのみ
            </v-btn>

            <v-alert v-if="testResult" :type="testResult.type" class="mt-4">
              {{ testResult.message }}
            </v-alert>

            <!-- 実際のRoundSettingインスタンスでテスト -->
            <v-card v-if="testInstance" variant="outlined" class="mt-4">
              <v-card-title>実際のインスタンステスト</v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="6">
                    <v-select
                      v-model="testInstance.operationResultSales"
                      :items="roundingOptions"
                      label="稼働実績売上"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-select
                      v-model="testInstance.operationResultTax"
                      :items="roundingOptions"
                      label="稼働実績消費税"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                </v-row>
                <p class="text-caption">
                  現在の値: sales="{{ testInstance.operationResultSales }}",
                  tax="{{ testInstance.operationResultTax }}"
                </p>
              </v-card-text>
            </v-card>

            <div v-if="testDetails.length > 0" class="mt-4">
              <h3>テスト結果詳細</h3>
              <v-expansion-panels>
                <v-expansion-panel
                  v-for="(test, index) in testDetails"
                  :key="index"
                >
                  <v-expansion-panel-title>
                    <v-icon
                      :color="test.success ? 'success' : 'error'"
                      class="mr-2"
                    >
                      {{ test.success ? "mdi-check" : "mdi-close" }}
                    </v-icon>
                    {{ test.name }}
                    <v-spacer />
                    <span class="text-caption">
                      {{ test.duration ? `${test.duration}ms` : "" }}
                    </span>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <pre>{{ test.details }}</pre>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { RoundSetting } from "@/schemas";

const testResult = ref(null);
const testDetails = ref([]);
const testInstance = ref(null);

const roundingOptions = [
  { title: "切り捨て", value: "FLOOR" },
  { title: "四捨五入", value: "ROUND" },
  { title: "切り上げ", value: "CEIL" },
];

const addTest = (name, success, details, duration = null) => {
  testDetails.value.push({
    name,
    success,
    details,
    duration,
  });
};

const runBasicTests = () => {
  const startTime = Date.now();
  testDetails.value = [];
  let passedTests = 0;
  let totalTests = 0;

  // 1. インスタンス作成テスト
  totalTests++;
  try {
    const instance = new RoundSetting();
    testInstance.value = instance;
    addTest(
      "インスタンス作成",
      true,
      `成功: ${instance.constructor.name}インスタンスが作成されました`
    );
    passedTests++;
  } catch (error) {
    addTest("インスタンス作成", false, `失敗: ${error.message}`);
  }

  // 2. 静的プロパティ（className）テスト
  totalTests++;
  try {
    const className = RoundSetting.className;
    const success = className === "端数処理設定クラス";
    addTest(
      "static className",
      success,
      success
        ? `成功: className = "${className}"`
        : `失敗: 期待値="端数処理設定クラス", 実際値="${className}"`
    );
    if (success) passedTests++;
  } catch (error) {
    addTest("static className", false, `エラー: ${error.message}`);
  }

  // 3. 静的定数テスト
  totalTests++;
  try {
    const constants = {
      FLOOR: RoundSetting.FLOOR,
      ROUND: RoundSetting.ROUND,
      CEIL: RoundSetting.CEIL,
    };
    const expectedConstants = {
      FLOOR: "FLOOR",
      ROUND: "ROUND",
      CEIL: "CEIL",
    };

    const success =
      JSON.stringify(constants) === JSON.stringify(expectedConstants);
    addTest(
      "静的定数 (FLOOR, ROUND, CEIL)",
      success,
      success
        ? `成功: ${JSON.stringify(constants, null, 2)}`
        : `失敗: 期待値=${JSON.stringify(
            expectedConstants,
            null,
            2
          )}, 実際値=${JSON.stringify(constants, null, 2)}`
    );
    if (success) passedTests++;
  } catch (error) {
    addTest("静的定数テスト", false, `エラー: ${error.message}`);
  }

  // 4. プロトタイプチェーン確認
  totalTests++;
  try {
    const instance = new RoundSetting();
    const isBaseClassChild = instance instanceof RoundSetting;
    addTest(
      "プロトタイプチェーン",
      isBaseClassChild,
      isBaseClassChild
        ? "成功: BaseClassを正しく継承しています"
        : "失敗: 継承に問題があります"
    );
    if (isBaseClassChild) passedTests++;
  } catch (error) {
    addTest("プロトタイプチェーン", false, `エラー: ${error.message}`);
  }

  // 5. インスタンスプロパティのデフォルト値テスト
  totalTests++;
  try {
    const instance = new RoundSetting();
    const salesDefault = instance.operationResultSales;
    const taxDefault = instance.operationResultTax;
    const success = salesDefault === "ROUND" && taxDefault === "ROUND";

    addTest(
      "デフォルト値テスト",
      success,
      success
        ? `成功: sales="${salesDefault}", tax="${taxDefault}"`
        : `失敗: sales="${salesDefault}" (期待値:"ROUND"), tax="${taxDefault}" (期待値:"ROUND")`
    );
    if (success) passedTests++;
  } catch (error) {
    addTest("デフォルト値テスト", false, `エラー: ${error.message}`);
  }

  const duration = Date.now() - startTime;
  testResult.value = {
    type: passedTests === totalTests ? "success" : "warning",
    message: `基本テスト完了: ${passedTests}/${totalTests} 件成功 (${duration}ms)`,
  };
};

const runAdvancedTests = () => {
  const startTime = Date.now();
  let passedTests = 0;
  let totalTests = 0;

  // 1. バリデーションテスト
  totalTests++;
  try {
    const validValues = ["FLOOR", "ROUND", "CEIL"];
    const invalidValues = [
      "INVALID",
      "floor",
      "round",
      null,
      undefined,
      123,
      "",
    ];

    let validationResults = [];
    let allValid = true;

    // 有効値テスト
    validValues.forEach((value) => {
      try {
        const result = RoundSetting.validate(value);
        validationResults.push(`${value}: ${result ? "OK" : "NG"}`);
        if (!result) allValid = false;
      } catch (error) {
        validationResults.push(`${value}: エラー - ${error.message}`);
        allValid = false;
      }
    });

    // 無効値テスト
    invalidValues.forEach((value) => {
      try {
        RoundSetting.validate(value);
        validationResults.push(`${value}: エラーが発生すべきだった`);
        allValid = false;
      } catch (error) {
        validationResults.push(`${value}: 正常にエラー`);
      }
    });

    addTest(
      "バリデーションテスト",
      allValid,
      `バリデーション結果:\n${validationResults.join("\n")}`
    );
    if (allValid) passedTests++;
  } catch (error) {
    addTest("バリデーションテスト", false, `エラー: ${error.message}`);
  }

  // 2. インスタンス値変更テスト
  totalTests++;
  try {
    const instance = new RoundSetting();
    const testValues = ["FLOOR", "CEIL", "ROUND"];
    let changeResults = [];
    let allChangesSuccessful = true;

    testValues.forEach((value) => {
      try {
        instance.operationResultSales = value;
        instance.operationResultTax = value;

        const salesMatches = instance.operationResultSales === value;
        const taxMatches = instance.operationResultTax === value;

        changeResults.push(
          `${value}: sales=${salesMatches ? "OK" : "NG"}, tax=${
            taxMatches ? "OK" : "NG"
          }`
        );

        if (!salesMatches || !taxMatches) {
          allChangesSuccessful = false;
        }
      } catch (error) {
        changeResults.push(`${value}: エラー - ${error.message}`);
        allChangesSuccessful = false;
      }
    });

    addTest(
      "インスタンス値変更テスト",
      allChangesSuccessful,
      `値変更結果:\n${changeResults.join("\n")}`
    );
    if (allChangesSuccessful) passedTests++;
  } catch (error) {
    addTest("インスタンス値変更テスト", false, `エラー: ${error.message}`);
  }

  // 3. 静的メソッドテスト
  totalTests++;
  try {
    let staticResults = [];
    let staticTestsSuccessful = true;

    // set メソッドテスト
    const testValues = ["FLOOR", "ROUND", "CEIL"];
    testValues.forEach((value) => {
      try {
        RoundSetting.set(value);
        const primitiveValue = String(RoundSetting);
        const success = primitiveValue === value;
        staticResults.push(
          `set(${value}) -> toPrimitive: ${primitiveValue} ${
            success ? "OK" : "NG"
          }`
        );
        if (!success) staticTestsSuccessful = false;
      } catch (error) {
        staticResults.push(`set(${value}): エラー - ${error.message}`);
        staticTestsSuccessful = false;
      }
    });

    addTest(
      "静的メソッドテスト",
      staticTestsSuccessful,
      `静的メソッド結果:\n${staticResults.join("\n")}`
    );
    if (staticTestsSuccessful) passedTests++;
  } catch (error) {
    addTest("静的メソッドテスト", false, `エラー: ${error.message}`);
  }

  // 4. Symbol.toPrimitive詳細テスト
  totalTests++;
  try {
    let primitiveResults = [];
    let primitiveTestsSuccessful = true;

    // 初期値テスト
    const initialValue = String(RoundSetting);
    primitiveResults.push(`初期値: "${initialValue}"`);

    // 各値での変換テスト
    ["FLOOR", "ROUND", "CEIL"].forEach((value) => {
      RoundSetting.set(value);
      const stringValue = String(RoundSetting);
      const numberValue = Number(RoundSetting);

      primitiveResults.push(
        `${value}設定後: string="${stringValue}", number=${numberValue}`
      );

      if (stringValue !== value) {
        primitiveTestsSuccessful = false;
      }
    });

    // 元に戻す
    RoundSetting.set("ROUND");

    addTest(
      "Symbol.toPrimitive詳細テスト",
      primitiveTestsSuccessful,
      `プリミティブ変換結果:\n${primitiveResults.join("\n")}`
    );
    if (primitiveTestsSuccessful) passedTests++;
  } catch (error) {
    addTest("Symbol.toPrimitive詳細テスト", false, `エラー: ${error.message}`);
  }

  // 5. クローンテスト
  totalTests++;
  try {
    const original = new RoundSetting();
    original.operationResultSales = "FLOOR";
    original.operationResultTax = "CEIL";

    const cloned = original.clone ? original.clone() : null;

    if (!cloned) {
      addTest("クローンテスト", false, "cloneメソッドが利用できません");
    } else {
      const success =
        cloned.operationResultSales === original.operationResultSales &&
        cloned.operationResultTax === original.operationResultTax &&
        cloned !== original; // 異なるインスタンス

      addTest(
        "クローンテスト",
        success,
        success
          ? `成功: 独立したクローンが作成されました\noriginal: sales="${original.operationResultSales}", tax="${original.operationResultTax}"\ncloned: sales="${cloned.operationResultSales}", tax="${cloned.operationResultTax}"`
          : `失敗: クローンが正しく作成されませんでした`
      );
      if (success) passedTests++;
    }
  } catch (error) {
    addTest("クローンテスト", false, `エラー: ${error.message}`);
  }

  const duration = Date.now() - startTime;
  const currentPassedTests = testDetails.value.filter(
    (test) => test.success
  ).length;
  const currentTotalTests = testDetails.value.length;

  testResult.value = {
    type: passedTests === totalTests ? "success" : "warning",
    message: `詳細テスト完了: ${passedTests}/${totalTests} 件成功 (${duration}ms) | 全体: ${currentPassedTests}/${currentTotalTests}`,
  };
};

const runAllTests = () => {
  testDetails.value = [];
  runBasicTests();
  setTimeout(() => {
    runAdvancedTests();
  }, 100);
};

onMounted(() => {
  // 初期テストインスタンスを作成
  try {
    testInstance.value = new RoundSetting();
  } catch (error) {
    console.error("初期インスタンス作成エラー:", error);
  }
});
</script>
