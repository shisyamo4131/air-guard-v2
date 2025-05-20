<script setup>
import { Company } from "air-guard-v2-schemas"; // Companyスキーマをインポート

const props = defineProps({
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
});

// フォームに表示するフィールドのキーと順序を定義
// 各オブジェクトは { key: string, label?: string, required?: boolean } の形式
const formFieldKeys = [
  { key: "name" }, // スキーマのrequired, labelを使用
  { key: "nameKana" }, // スキーマのrequired, labelを使用
  { key: "zipcode" }, // 例: UI上では必須にしたい場合 { key: "zipcode", required: true }
  { key: "prefecture" },
  { key: "city" },
  { key: "address", label: "詳細住所（番地まで）" }, // 例: UI固有のラベル上書き
  { key: "building" },
  { key: "tel", required: true }, // 例: スキーマでは任意だが、このフォームでは必須
  { key: "fax" },
];

// 上記キーに基づいて、ラベル情報などを付加したフィールド定義を生成
const formFields = formFieldKeys.map((fieldDef) => {
  const classProp = Company.classProps[fieldDef.key];
  return {
    key: fieldDef.key,
    // fieldDef.label があればそれを優先、なければスキーマ定義、それもなければキー名をフォールバック
    label: fieldDef.label || classProp?.label || fieldDef.key,
    // fieldDef.required が boolean 型で定義されていればそれを優先、なければスキーマ定義、それもなければ false をフォールバック
    required:
      typeof fieldDef.required === "boolean"
        ? fieldDef.required
        : classProp?.required || false,
    // 使用するコンポーネントは air-text-field に固定
    // component: resolveComponent("air-text-field"), // もし air-text-field がグローバルでない場合
  };
});
</script>

<template>
  <v-form>
    <!-- air-text-field を直接使用 -->
    <air-text-field
      v-for="field in formFields"
      :key="field.key"
      :model-value="props.item[field.key]"
      :label="field.label"
      :required="field.required"
      @update:model-value="props.updateProperties({ [field.key]: $event })"
    />
  </v-form>
</template>
