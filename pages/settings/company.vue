<script setup>
import { Company } from "air-guard-v2-schemas";
import { computed } from "vue";
const logger = useLogger();
const sender = "company.vue";
const auth = useAuthStore();

// --- データ取得処理 ---
// `reactiveKey` として会社IDを含めた文字列を computed で用意し、`auth.companyId` の変更に追従するようにします。
// `reactiveKey` が変更されるとデータが再取得される。
// `reactiveKey` に変更がない状態で再度ページが表示される際はキャッシュが利用されます。
const reactiveKey = computed(() => `company-${auth.companyId}`); // auth.companyId を直接使用してリアクティビティを確保

const { data: companyModelRef, error: companyFetchError } = await useAsyncData(
  reactiveKey,
  async () => {
    const currentCompanyId = auth.companyId;
    const companyInstance = new Company();

    // 会社IDが未定義の場合は空のインスタンスを返す（テンプレートは '-' を表示）
    if (!currentCompanyId) {
      const message =
        "`companyId` is not defined. Returning empty company model.";
      logger.warn({ sender, message });
      return companyInstance;
    }

    // FireModel.fetch で会社情報をインスタンスに読み込んで返す
    // 読み込みでエラーが発生した場合は logger.error でログ出力（同時にグローバルエラーが蓄積）
    try {
      // await companyInstance.fetch({ docId: currentCompanyId });
      companyInstance.subscribe({ docId: currentCompanyId });
      // if (!companyInstance.docId) {
      //   throw new Error(
      //     `No company document found for ID ${currentCompanyId}.`
      //   );
      // }
      return companyInstance;
    } catch (error) {
      const message = `Failed to fetch company data for ID ${currentCompanyId}.`;
      logger.error({ sender, message, error });
      // useAsyncData の error リファレンスにエラーを伝播させるために再スロー
      throw error;
    }
  }
);

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);
</script>

<template>
  <v-container>
    <v-card class="mx-auto" elevation="2">
      <v-card-title> 会社情報 </v-card-title>
      <v-container>
        <!-- データ取得固有のエラーメッセージ表示 -->
        <v-alert v-if="companyFetchError" type="error" dense class="mb-4">
          会社情報の取得に失敗しました。詳細: {{ companyFetchError.message }}
        </v-alert>
        <v-list v-else-if="companyModelRef" lines="two" density="compact">
          <template v-for="field in companyFields" :key="field">
            <v-list-item>
              <v-list-item-subtitle>
                {{ Company.classProps[field]?.label || field }}
              </v-list-item-subtitle>
              <v-list-item-title>
                {{ companyModelRef[field] || "-" }}
              </v-list-item-title>
            </v-list-item>
            <v-divider
              v-if="field !== companyFields[companyFields.length - 1]"
            ></v-divider>
          </template>
        </v-list>
      </v-container>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          :disabled="!!companyFetchError"
          variant="elevated"
        >
          編集する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<style></style>
