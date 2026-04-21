<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Manager/index.vue
 * @description 取極め管理コンポーネント
 * @extends AirArrayManager
 *
 * - `AgreementV2` インスタンスの配列を管理するためのコンポーネント。
 * - FireStore への CRUD 操作は行わない、純粋な配列管理 UI コンポーネント。
 *****************************************************************************/
import { AgreementV2 } from "@/schemas";
import { useDefaults } from "vuetify";
import { useBaseManager } from "@/composables/useBaseManager";
import AgreementInput from "@/components/Agreement/Input/index.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  modelValue: { type: Array, default: () => [] },
  shiftType: { type: String, default: "DAY" },
});
const props = useDefaults(_props, "AgreementsManager");
const emit = defineEmits(["update:modelValue", "update:shiftType"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs: baseManagerAttrs } = useBaseManager("AgreementsManager");

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
const currentAgreement = ref(null);
const internalShiftType = ref(props.shiftType); // 内部管理用 `shiftType`

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
// `shiftType` の同期処理
watch(
  () => props.shiftType,
  (newValue) => (internalShiftType.value = newValue),
  { immediate: true },
);
watch(internalShiftType, (newValue) => emit("update:shiftType", newValue));

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
</script>

<template>
  <AirArrayManager
    v-bind="baseManagerAttrs"
    :model-value="props.modelValue"
    :custom-input="AgreementInput"
    :dialog-props="{ maxWidth: 960 }"
    :schema="AgreementV2"
    item-key="key"
    :error-messages="{
      duplicateKey: '同じ適用開始日で登録された取極めが存在します',
    }"
    :before-edit="(editMode, item) => (item.shiftType = internalShiftType)"
    @create="($event) => (currentAgreement = $event)"
    @delete="currentAgreement = null"
    @update:modelValue="($event) => emit('update:modelValue', $event)"
  >
    <template #table="{ items, toCreate, toUpdate }">
      <v-card>
        <v-toolbar color="secondary" density="compact" title="取極め">
          <template #append>
            <v-btn icon="mdi-plus" size="small" @click="() => toCreate()" />
            <v-btn
              :disabled="!currentAgreement"
              icon="mdi-pencil"
              size="small"
              @click="() => toUpdate(currentAgreement)"
            />
            <v-btn
              :disabled="!currentAgreement"
              icon="mdi-content-copy"
              size="small"
              @click="() => toCreate(currentAgreement)"
            />
          </template>
        </v-toolbar>
        <v-card-text class="py-0">
          <AgreementsViewer
            :agreements="items"
            v-model:shiftType="internalShiftType"
            @update:currentAgreement="currentAgreement = $event"
          />
        </v-card-text>
      </v-card>
    </template>
  </AirArrayManager>
</template>
