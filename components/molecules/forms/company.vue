<script setup>
import AtomsSelectPrefecture from "~/components/atoms/SelectPrefecture.vue"; // 都道府県選択コンポーネントをインポート
import { Company } from "air-guard-v2-schemas";
defineOptions({ name: "MoleculesFormsCompany" });
const props = defineProps({
  item: { type: Object, required: true },
  updateProperties: { type: Function, required: true },
});

const schema = Object.entries(Company.classProps).map(([key, value]) => {
  return { key, ...value };
});
</script>

<template>
  <air-form
    v-bind="$attrs"
    :item="props.item"
    :update-properties="props.updateProperties"
    :schema="schema"
  >
    <template #prefecture="{ field, modelValue, updateModelValue }">
      <AtomsSelectPrefecture
        :model-value="modelValue"
        :label="field.label"
        :required="field.required"
        @update:model-value="updateModelValue"
      />
    </template>
  </air-form>
</template>
