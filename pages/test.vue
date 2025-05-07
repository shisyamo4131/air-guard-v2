<script setup>
import { ref, onMounted, computed } from "vue";
import ItemManager from "@/components/renderless/ItemManager.vue"; // ItemManager のパスを確認
// パッケージ名から Company をインポート
import { Company } from "air-guard-v2-schemas";

// --- Firestore エミュレーター接続確認 ---
// このページ自体ではなく、プロジェクトの Firebase 初期化部分で
// Firestore エミュレーターへの接続設定がされているか確認してください。
// 例: firebase.firestore().useEmulator('localhost', 8080);

const companyIdToTest = ref("test-company-for-manager"); // テストに使用するドキュメントID
const companyInstance = ref(null); // ItemManager に渡す Company インスタンス
const loadingData = ref(false);
const dataError = ref(null);
const lastEvent = ref(null); // ItemManager からのイベント表示用
const isManagerEditing = ref(false); // ItemManager の isEditing 状態を同期

// --- データ準備 ---
// テスト用の会社データを取得または作成
async function prepareTestData() {
  loadingData.value = true;
  dataError.value = null;
  lastEvent.value = null;
  try {
    const existingCompany = new Company();
    // FireModel の fetch メソッドに prefix が必要な場合は適宜追加してください
    const found = await existingCompany.fetch({
      docId: companyIdToTest.value /*, prefix: 'your-prefix' */,
    });

    if (found) {
      console.log(
        "既存のテストデータを読み込みました:",
        existingCompany.toObject()
      );
      companyInstance.value = existingCompany;
    } else {
      console.log("テストデータが存在しないため、新規作成します。");
      const newCompanyData = {
        docId: companyIdToTest.value, // 固定IDで作成
        name: "テスト用株式会社",
        nameKana: "テストヨウカブシキガイシャ",
        zipcode: "999-9999",
        prefecture: "テスト県",
        city: "テスト市",
        address: "テスト町1",
        building: "テストビル1F", // 修正後のプロパティ名
        tel: "00-0000-0000",
        fax: "11-1111-1111",
      };
      const newCompany = new Company(newCompanyData);
      // FireModel の create メソッドに prefix が必要な場合は適宜追加してください
      await newCompany.create({
        docId: companyIdToTest.value /*, prefix: 'your-prefix' */,
      }); // Firestore に作成 (useAutonumber=false 想定)
      console.log("新規テストデータを作成しました:", newCompany.toObject());
      companyInstance.value = newCompany;
    }
  } catch (err) {
    console.error("テストデータの準備中にエラー:", err);
    dataError.value = `テストデータの準備に失敗しました: ${err.message}`;
    companyInstance.value = null;
  } finally {
    loadingData.value = false;
  }
}

// --- ItemManager のハンドラー ---

// 更新処理 (Firestore に保存)
async function handleCompanyUpdate(updatedItem) {
  lastEvent.value = { type: "handleUpdate", data: updatedItem.toObject() };
  console.log("handleUpdate が呼ばれました:", updatedItem.toObject());
  try {
    // updatedItem は ItemManager 内でクローンされたものなので、
    // そのインスタンスの update メソッドを呼ぶ
    // FireModel の update メソッドに prefix が必要な場合は適宜追加してください
    await updatedItem.update({
      /* prefix: 'your-prefix' */
    }); // FireModel の update メソッド
    console.log("Firestore の更新が成功しました。");
    // 更新成功後、親の companyInstance も更新されたデータで置き換える
    // (ItemManager の update:modelValue でも更新されるが、念のため)
    companyInstance.value = updatedItem;
  } catch (err) {
    console.error("Firestore の更新中にエラー:", err);
    // ItemManager 側でエラーが捕捉されるはずだが、ここでもエラー処理可能
    lastEvent.value = { type: "handleUpdate Error", error: err.message };
    throw err; // エラーを再スローして ItemManager に伝える
  }
}

// 削除処理 (Firestore から削除)
async function handleCompanyDelete(itemToDelete) {
  lastEvent.value = { type: "handleDelete", data: itemToDelete.toObject() };
  console.log("handleDelete が呼ばれました:", itemToDelete.toObject());
  try {
    // itemToDelete は削除対象のインスタンス
    // FireModel の delete メソッドに prefix が必要な場合は適宜追加してください
    await itemToDelete.delete({
      /* prefix: 'your-prefix' */
    }); // FireModel の delete メソッド
    console.log("Firestore からの削除が成功しました。");
    // 削除成功後、親の companyInstance を null にする
    companyInstance.value = null;
  } catch (err) {
    console.error("Firestore の削除中にエラー:", err);
    lastEvent.value = { type: "handleDelete Error", error: err.message };
    throw err; // エラーを再スローして ItemManager に伝える
  }
}

// ItemManager の完了イベント
function handleSubmitComplete(payload) {
  lastEvent.value = { type: "submit:complete", payload };
  console.log("submit:complete イベント:", payload);
  // 削除が完了したらデータを再読み込みするか、リスト表示ならリストから消すなど
  if (payload.editMode === "DELETE") {
    // データが存在しなくなったのでリセット
    companyInstance.value = null;
  }
}

// ItemManager の update:modelValue イベント
function handleModelUpdate(updatedItem) {
  lastEvent.value = { type: "update:modelValue", data: updatedItem.toObject() };
  console.log("update:modelValue イベント:", updatedItem.toObject());
  // v-model を使っているので自動的に companyInstance.value が更新される
}

// ItemManager の update イベント
function handleUpdateEvent(updatedItem) {
  lastEvent.value = { type: "update", data: updatedItem.toObject() };
  console.log("update イベント:", updatedItem.toObject());
}

// ItemManager の delete イベント
function handleDeleteEvent(itemToDelete) {
  lastEvent.value = { type: "delete", data: itemToDelete.toObject() };
  console.log("delete イベント:", itemToDelete.toObject());
  // このイベントは submit 前に呼ばれる handleDelete フックの後、
  // submit 完了前に emit される
}

// --- 表示用ラベル ---
const fieldLabels = {
  name: "会社名",
  nameKana: "会社名カナ",
  zipcode: "郵便番号",
  prefecture: "都道府県",
  city: "市区町村",
  address: "番地",
  building: "建物名", // 修正後のプロパティ名
  tel: "電話番号",
  fax: "FAX番号",
};
// 表示順
const companyFields = Object.keys(fieldLabels);

// --- ライフサイクル ---
onMounted(() => {
  prepareTestData();
});
</script>

<template>
  <v-container>
    <h1 class="text-h4 mb-4">ItemManager テスト (Company モデル)</h1>

    <v-alert v-if="dataError" type="error" class="mb-4">
      {{ dataError }}
    </v-alert>

    <v-btn
      @click="prepareTestData"
      :loading="loadingData"
      color="primary"
      class="mb-4"
    >
      テストデータ準備/再読込
    </v-btn>

    <v-divider class="my-4"></v-divider>

    <div v-if="loadingData">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <p>テストデータを準備中...</p>
    </div>

    <div v-else-if="!companyInstance">
      <v-alert type="info">テスト対象の会社データがありません。</v-alert>
    </div>

    <!-- ItemManager を使用 -->
    <ItemManager
      v-else
      v-model="companyInstance"
      v-model:isEditing="isManagerEditing"
      :handle-update="handleCompanyUpdate"
      :handle-delete="handleCompanyDelete"
      @submit:complete="handleSubmitComplete"
      @update:modelValue="handleModelUpdate"
      @update="handleUpdateEvent"
      @delete="handleDeleteEvent"
    >
      <template
        #default="{
          item,
          submit,
          updateProperties,
          toUpdate,
          toDelete,
          quitEditing,
          isEditing,
          hasError,
        }"
      >
        <v-card>
          <v-card-title>会社情報 (ItemManager 管理)</v-card-title>
          <v-card-subtitle>
            編集中: {{ isEditing }} / エラー: {{ hasError }}
          </v-card-subtitle>

          <v-card-text>
            <v-alert
              v-if="hasError"
              type="warning"
              density="compact"
              class="mb-3"
            >
              ItemManager
              内でエラーが発生しました。コンソールを確認してください。
            </v-alert>

            <v-form :disabled="!isEditing">
              <v-row>
                <v-col
                  v-for="field in companyFields"
                  :key="field"
                  cols="12"
                  md="6"
                >
                  <v-text-field
                    :label="fieldLabels[field]"
                    :model-value="item ? item[field] : ''"
                    @update:modelValue="updateProperties({ [field]: $event })"
                    :readonly="!isEditing"
                    variant="outlined"
                    density="compact"
                    hide-details="auto"
                  ></v-text-field>
                </v-col>
              </v-row>
            </v-form>

            <v-divider class="my-4"></v-divider>
            <h3 class="text-subtitle-1 mb-2">
              現在の ItemManager スロット item の値:
            </h3>
            <pre
              style="
                background-color: #f5f5f5;
                padding: 10px;
                border-radius: 4px;
                max-height: 200px;
                overflow-y: auto;
              "
              >{{ JSON.stringify(item?.toObject(), null, 2) }}</pre
            >
          </v-card-text>

          <v-card-actions>
            <v-btn v-if="!isEditing" @click="toUpdate" color="primary"
              >編集開始</v-btn
            >
            <v-btn v-if="!isEditing" @click="toDelete" color="error"
              >削除モード</v-btn
            >
            <v-btn v-if="isEditing" @click="submit" color="success"
              >確定 ({{
                isEditing ? (item?.docId ? "更新" : "作成") : ""
              }})</v-btn
            >
            <v-btn v-if="isEditing" @click="quitEditing" color="grey"
              >キャンセル</v-btn
            >
            <v-spacer></v-spacer>
            <v-chip
              v-if="isEditing"
              color="orange"
              variant="outlined"
              size="small"
              >編集中</v-chip
            >
          </v-card-actions>
        </v-card>
      </template>
    </ItemManager>

    <v-divider class="my-4"></v-divider>

    <v-card class="mt-4">
      <v-card-title>イベントログ</v-card-title>
      <v-card-text>
        <p v-if="!lastEvent">まだイベントは発生していません。</p>
        <pre
          v-else
          style="background-color: #eee; padding: 10px; border-radius: 4px"
          >{{ JSON.stringify(lastEvent, null, 2) }}</pre
        >
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
