<script setup>
import { Article } from "@/schemas";

/*****************************************************************************
 * Article クラス 単体テスト
 *****************************************************************************/

const results = ref([]);

function log(label, passed, detail = "") {
  results.value.push({ label, passed, detail });
}

function runTests() {
  results.value = [];

  // -------------------------------------------------------------------------
  // 1. デフォルト初期化
  // -------------------------------------------------------------------------
  const a1 = new Article();
  log(
    "1. デフォルト初期化 - code が null",
    a1.code === null,
    `code: ${a1.code}`,
  );
  log(
    "1. デフォルト初期化 - name が null",
    a1.name === null,
    `name: ${a1.name}`,
  );
  log("1. デフォルト初期化 - price が 0", a1.price === 0, `price: ${a1.price}`);

  // -------------------------------------------------------------------------
  // 2. 初期値を与えた初期化
  // -------------------------------------------------------------------------
  const a2 = new Article({ code: "W001", name: "無線機利用料", price: 500 });
  log("2. 初期化 - code", a2.code === "W001", `code: ${a2.code}`);
  log("2. 初期化 - name", a2.name === "無線機利用料", `name: ${a2.name}`);
  log("2. 初期化 - price", a2.price === 500, `price: ${a2.price}`);

  // -------------------------------------------------------------------------
  // 3. バリデーション - 正常系
  // -------------------------------------------------------------------------
  const a3 = new Article({ name: "指名料", price: 1000 });
  let err3 = null;
  try {
    a3.validate();
  } catch (e) {
    err3 = e;
  }
  log(
    "3. バリデーション正常系 - エラーなし",
    err3 === null,
    err3?.message ?? "",
  );

  // -------------------------------------------------------------------------
  // 4. バリデーション - name 未入力
  // -------------------------------------------------------------------------
  const a4 = new Article({ price: 100 });
  let err4 = null;
  try {
    a4.validate();
  } catch (e) {
    err4 = e;
  }
  log(
    "4. バリデーション - name 未入力でエラー",
    err4 !== null,
    err4?.message ?? "エラーなし",
  );

  // -------------------------------------------------------------------------
  // 5. バリデーション - price 未入力（null）
  // -------------------------------------------------------------------------
  const a5 = new Article({ name: "テスト商品" });
  a5.price = null;
  let err5 = null;
  try {
    a5.validate();
  } catch (e) {
    err5 = e;
  }
  log(
    "5. バリデーション - price null でエラー",
    err5 !== null,
    err5?.message ?? "エラーなし",
  );

  // -------------------------------------------------------------------------
  // 6. バリデーション - price 負の値
  // -------------------------------------------------------------------------
  const a6 = new Article({ name: "テスト商品", price: -1 });
  let err6 = null;
  try {
    a6.validate();
  } catch (e) {
    err6 = e;
  }
  log(
    "6. バリデーション - price 負の値でエラー",
    err6 !== null,
    err6?.message ?? "エラーなし",
  );

  // -------------------------------------------------------------------------
  // 7. tokenMap
  // -------------------------------------------------------------------------
  const a7 = new Article({ code: "T001", name: "テスト" });
  const hasTokenMap = a7.tokenMap && typeof a7.tokenMap === "object";
  log("7. tokenMap が生成される", hasTokenMap, JSON.stringify(a7.tokenMap));

  // -------------------------------------------------------------------------
  // 8. toObject
  // -------------------------------------------------------------------------
  const a8 = new Article({
    code: "C001",
    name: "商品A",
    price: 300,
    remarks: "備考",
  });
  const obj = a8.toObject();
  log(
    "8. toObject - プレーンオブジェクトに変換",
    typeof obj === "object" && obj.name === "商品A" && obj.price === 300,
    JSON.stringify(obj),
  );

  // -------------------------------------------------------------------------
  // 9. clone
  // -------------------------------------------------------------------------
  const a9 = new Article({ name: "商品B", price: 200 });
  const cloned = a9.clone();
  log(
    "9. clone - 独立したインスタンス",
    cloned !== a9 && cloned.name === a9.name && cloned.price === a9.price,
    `original: ${a9.name}, clone: ${cloned.name}`,
  );
}
</script>

<template>
  <v-container>
    <v-card class="mb-4">
      <v-card-title>Article クラス 単体テスト</v-card-title>
      <v-card-actions>
        <v-btn color="primary" @click="runTests">テスト実行</v-btn>
      </v-card-actions>
    </v-card>

    <v-list v-if="results.length">
      <v-list-item
        v-for="(r, i) in results"
        :key="i"
        :base-color="r.passed ? 'success' : 'error'"
      >
        <template #prepend>
          <v-icon :color="r.passed ? 'success' : 'error'">
            {{ r.passed ? "mdi-check-circle" : "mdi-close-circle" }}
          </v-icon>
        </template>
        <v-list-item-title>{{ r.label }}</v-list-item-title>
        <v-list-item-subtitle>{{ r.detail }}</v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </v-container>
</template>
