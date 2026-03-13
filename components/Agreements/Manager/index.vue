<script setup>
/*****************************************************************************
 * @file ./components/organisms/AgreementsManager.vue
 * @description `AirArrayManager` をベースにした、取極め管理用コンポーネント
 * - 既存の取極めを選択するための UI を提供します。
 * 注意: その他のプロパティはすべて air-array-manager に渡されます。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { useAuthStore } from "@/stores/useAuthStore.js";

defineOptions({ name: "AgreementsManager" });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  isCompany: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "AgreementsManager");
const emit = defineEmits(["update:modelValue"]);

/*****************************************************************************
 * SETUP STORES
 *****************************************************************************/
const auth = useAuthStore();
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
          <v-col v-if="!props.isCompany">
            <AgreementsSelector
              :agreements="props.modelValue"
              clear-on-select
              return-object
              @update:modelValue="
                ($event) => {
                  updateProperties({ ...$event[0].billingInfo });
                }
              "
            >
              <template #activator="{ props: activatorProps }">
                <v-btn
                  v-bind="activatorProps"
                  :disabled="!props.modelValue.length"
                  block
                  color="primary"
                >
                  現場取極め参照
                </v-btn>
              </template>
            </AgreementsSelector>
          </v-col>
          <v-col>
            <AgreementsSelector
              :agreements="auth.company.agreements"
              clear-on-select
              return-object
              @update:modelValue="
                ($event) => {
                  updateProperties({ ...$event[0].billingInfo });
                }
              "
            >
              <template #activator="{ props: activatorProps }">
                <v-btn
                  v-bind="activatorProps"
                  :disabled="!auth.company.agreements.length"
                  block
                  color="secondary"
                >
                  会社取極め参照
                </v-btn>
              </template>
            </AgreementsSelector>
          </v-col>
        </v-row>
      </v-col>
    </template>

    <!-- `isStartNextDay` の入力フィールドをカスタマイズ -->
    <template #[`input.isStartNextDay`]="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>

    <template #table="tableProps">
      <AgreementsIterator
        :agreements="tableProps.items"
        show-create
        show-edit
        show-expand
        @click:create="tableProps.toCreate()"
        @click:edit="tableProps.toUpdate($event)"
      />
      <!-- </v-card-text>
      </v-card> -->
    </template>

    <!-- その他のスロットをパススルー -->
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
