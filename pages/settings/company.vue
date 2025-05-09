<script setup>
import { Company } from "air-guard-v2-schemas";

const logger = useLogger();
const errors = useErrorsStore();
const auth = useAuthStore();
const companyId = auth.companyId;
// const companyModelRef = new Company();
//test
// --- データ取得処理 ---
const { data: companyModelRef } = await useAsyncData(
  `company-${companyId}`,
  async () => {
    const companyInstance = new Company();
    if (!companyId) {
      logger.warn({
        sender: "company.vue",
        message: "`companyId` is not defined.",
      });
    } else {
      try {
        await companyInstance.fetch({ docId: companyId });
      } catch (error) {
        logger.error({
          sender: "company.vue",
          message: error.message,
          error,
        });
      }
    }
    return companyInstance;
  }
);

// --- 表示用のラベル定義 ---
const fieldLabels = {
  name: "会社名",
  nameKana: "会社名カナ",
  zipcode: "郵便番号",
  prefecture: "都道府県",
  city: "市区町村",
  address: "番地",
  building: "建物名",
  tel: "電話番号",
  fax: "FAX番号",
};

// --- 表示フィールドの定義 ---
const companyFields = Object.keys(Company.classProps);
</script>

<template>
  <v-container>
    <v-card class="mx-auto" max-width="800" elevation="2">
      <v-card-title class="text-h5 pa-4 bg-primary"> 会社情報 </v-card-title>

      <v-card-text>
        <v-list v-if="!errors.hasError" lines="two" density="compact">
          <template v-for="field in companyFields" :key="field">
            <v-list-item>
              <v-list-item-subtitle>
                {{ fieldLabels[field] || field }}
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
      </v-card-text>

      <!-- 必要に応じて編集ボタンなどを追加 -->
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated"> 編集する </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<style></style>
