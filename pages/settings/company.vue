<script setup>
import { ref, onMounted } from "vue";
// Company モデルをインポート (パスはプロジェクト構成に合わせて調整してください)
// import Company from 'air-guard-v2-schemas/src/Company'; // パスを修正

// --- データ取得処理 ---
// 初期値を null にしてローディング状態を表現
const companyInfo = ref(null);
const loading = ref(true); // ローディング状態を管理するフラグ
const error = ref(null); // エラー状態を管理

// --- 表示用のラベル定義 ---
const fieldLabels = {
  name: "会社名",
  nameKana: "会社名カナ",
  zipcode: "郵便番号",
  prefecture: "都道府県",
  city: "市区町村",
  address: "番地",
  buiding: "建物名", // Company.js の定義に合わせて 'buiding'
  tel: "電話番号",
  fax: "FAX番号",
};

// --- 表示フィールドの定義 ---
// Company.js の classProps のキーを取得 (表示順序を考慮する場合は別途定義)
// import Company from 'air-guard-v2-schemas/src/Company'; // 再度インポートが必要な場合
// const companyFields = Object.keys(Company.classProps);
// ↓ Company.js を直接参照できない、または表示順を固定したい場合は手動で定義
const companyFields = [
  "name",
  "nameKana",
  "zipcode",
  "prefecture",
  "city",
  "address",
  "buiding", // Company.js の定義に合わせて 'buiding'
  "tel",
  "fax",
];

// --- データ取得処理 (仮の非同期処理) ---
// onMounted フックでデータを取得する想定
onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    // --- ここから実際のデータ取得処理に置き換える ---
    // 例: APIからフェッチする場合
    // const response = await fetch('/api/company'); // 適切なエンドポイントを指定
    // if (!response.ok) {
    //   throw new Error('会社情報の取得に失敗しました');
    // }
    // const data = await response.json();
    // companyInfo.value = data;

    // 例: FireModel を使う場合 (Company.js の find メソッドが存在すると仮定)
    // const companyData = await Company.find(/* クエリ条件, 例: { limit: 1 } */);
    // if (companyData && companyData.length > 0) {
    //   // FireModel のインスタンスからデータを取得する方法に合わせて調整
    //   // companyInfo.value = companyData[0].getData ? companyData[0].getData() : companyData[0];
    //   // ↓ 仮のデータで代用
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒待機 (ローディング表示確認用)
    companyInfo.value = {
      name: "サンプル株式会社",
      nameKana: "サンプルカブシキガイシャ",
      zipcode: "100-0000",
      prefecture: "東京都",
      city: "千代田区",
      address: "丸の内1-1-1",
      buiding: "サンプルビル 5F",
      tel: "03-1234-5678",
      fax: "03-1234-5679",
    };
    // } else {
    //   throw new Error('会社情報が見つかりません');
    // }
    // --- ここまで ---
  } catch (err) {
    console.error("会社情報の取得エラー:", err);
    error.value = err.message || "データの取得中にエラーが発生しました。";
    companyInfo.value = null; // エラー時はデータをクリア
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-container>
    <v-card class="mx-auto" max-width="800" elevation="2">
      <v-card-title class="text-h5 pa-4 bg-primary"> 会社情報 </v-card-title>

      <v-card-text>
        <!-- ローディング表示 -->
        <div v-if="loading" class="text-center pa-6">
          <v-progress-circular
            indeterminate
            color="primary"
            size="64"
          ></v-progress-circular>
          <p class="mt-4">読み込み中...</p>
        </div>

        <!-- エラー表示 -->
        <v-alert
          v-else-if="error"
          type="error"
          variant="tonal"
          prominent
          border="start"
          class="mb-4"
        >
          {{ error }}
        </v-alert>

        <!-- 会社情報表示 -->
        <v-list v-else-if="companyInfo" lines="two" density="compact">
          <template v-for="field in companyFields" :key="field">
            <v-list-item>
              <v-list-item-title class="font-weight-medium text-grey-darken-1">
                {{ fieldLabels[field] || field }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-body-1 text-grey-darken-4">
                {{ companyInfo[field] || "-" }}
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider
              v-if="field !== companyFields[companyFields.length - 1]"
            ></v-divider>
          </template>
        </v-list>

        <!-- データがない場合の表示 -->
        <div v-else class="text-center pa-6 text-grey">
          会社情報が登録されていません。
        </div>
      </v-card-text>

      <!-- 必要に応じて編集ボタンなどを追加 -->
      <v-card-actions v-if="!loading && !error && companyInfo">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated"> 編集する </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<style scoped>
/* Vuetify がスタイルを管理するため、通常は scoped style は不要になります */
/* 必要に応じて微調整するためのスタイルを追加できます */
.v-list-item-title {
  /* 必要であればタイトルのスタイルを調整 */
}
.v-list-item-subtitle {
  /* 値が空の場合に高さが潰れないように */
  min-height: 1.5em;
}
</style>
