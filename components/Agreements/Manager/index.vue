<script setup>
/*****************************************************************************
 * @file ./components/organisms/AgreementsManager.vue
 * @description `AirArrayManager` をベースにした、取極め管理用コンポーネント
 * - 既存の取極めを選択するための UI を提供します。
 * 注意: その他のプロパティはすべて air-array-manager に渡されます。
 *
 * @property {Array} modelValue - 取極めの配列。`AirArrayManager` の `modelValue` として機能します。
 * @property {Boolean} referable - 自身の取極め参照機能を有効にするかどうか
 *
 * @emits update:modelValue - 取極めの配列が更新されたときに発火します。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import CompanyAgreementsSelector from "./CompanyAgreementsSelector.vue";
import SiteAgreementsSelector from "./SiteAgreementsSelector.vue";

defineOptions({ name: "AgreementsManager" });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  isCompany: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] },
  referable: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AgreementsManager");
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <air-array-manager
    :model-value="props.modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
  >
    <!-- 基本単価の上に `AgreementsSelector` を配置する -->
    <template #before-unitPriceBase="{ field, updateProperties }">
      <v-col v-bind="field.colsDefinition">
        <v-row>
          <v-col v-if="props.referable">
            <!-- 現場取極め参照ボタン -->
            <SiteAgreementsSelector
              :model-value="props.modelValue"
              :update-properties="updateProperties"
            />
          </v-col>
          <v-col>
            <!-- 会社取極め参照ボタン -->
            <CompanyAgreementsSelector :update-properties="updateProperties" />
          </v-col>
        </v-row>
      </v-col>
    </template>

    <!-- `isStartNextDay` の入力フィールドをカスタマイズ -->
    <template #[`input.isStartNextDay`]="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>

    <template #table="tableProps">
      <v-card>
        <v-card-item>
          <template #append>
            <v-btn
              icon="mdi-plus"
              color="primary"
              variant="text"
              @click="tableProps.toCreate()"
            />
          </template>
          <v-card-title>取極め</v-card-title>
        </v-card-item>
        <v-card-text>
          <AgreementsIterator
            :agreements="tableProps.items"
            show-create
            show-edit
            show-expand
            @click:create="tableProps.toCreate()"
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
