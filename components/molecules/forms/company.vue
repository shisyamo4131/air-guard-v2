<script setup>
import { Company } from "air-guard-v2-schemas"; // Companyスキーマをインポート

const props = defineProps({
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
});

// フォームに表示するフィールドのキーと順序を定義
const formFieldKeys = [
  "name",
  "nameKana",
  "zipcode",
  "prefecture",
  "city",
  "address",
  "building",
  "tel",
  "fax",
];

// 上記キーに基づいて、ラベル情報などを付加したフィールド定義を生成
const formFields = formFieldKeys.map((key) => ({
  key: key,
  label: Company.classProps[key]?.label || key, // Companyスキーマからラベルを取得
}));
</script>

<template>
  <v-form>
    <air-text-field
      v-for="field in formFields"
      :key="field.key"
      :model-value="props.item[field.key]"
      :label="field.label"
      @update:model-value="props.updateProperties({ [field.key]: $event })"
    />
  </v-form>
</template>
