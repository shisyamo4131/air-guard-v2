<script setup>
/*****************************************************************************
 * @file ./components/organisms/AgreementsManager.vue
 * @description `AirArrayManager` をベースにした、取極め管理用コンポーネント
 * - 既存の取極めを選択するための UI を提供します。
 *
 * @prop {Array} selectableItems - 選択可能な取極めのリスト
 * 注意: その他のプロパティはすべて air-array-manager に渡されます。
 *****************************************************************************/
import { useDefaults } from "vuetify";

defineOptions({ name: "AgreementsManager" });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  selectableItems: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "AgreementsManager");
</script>

<template>
  <air-array-manager>
    <!-- 基本単価の上に `AgreementsSelector` を配置する -->
    <template #before-unitPriceBase="{ field, updateProperties }">
      <v-col v-bind="field.colsDefinition">
        <AgreementsSelector
          :agreements="props.selectableItems"
          clear-on-select
          return-object
          @update:modelValue="
            ($event) => {
              updateProperties({ ...$event[0].billingInfo });
            }
          "
        >
          <template #activator="{ props: activatorProps }">
            <v-btn v-bind="activatorProps" block color="primary">
              取極めから参照設定
            </v-btn>
          </template>
        </AgreementsSelector>
      </v-col>
    </template>

    <!-- `isStartNextDay` の入力フィールドをカスタマイズ -->
    <template #[`input.isStartNextDay`]="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>

    <template #table="tableProps">
      <v-card prepend-icon="mdi-file-document-multiple-outline">
        <template #append>
          <v-icon icon="mdi-plus" @click="() => tableProps.toCreate()" />
        </template>
        <template #title>既定の取極め</template>
        <!-- <air-data-table v-bind="tableProps" /> -->
        <v-card-text class="pb-0">
          <AgreementsIterator
            :agreements="tableProps.items"
            show-edit
            show-expand
            @click:edit="tableProps.toUpdate($event)"
          />
        </v-card-text>
      </v-card>
    </template>

    <!-- その他のスロットをパススルー -->
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
