<script setup>
/*****************************************************************************
 * @file ./components/Agreements/Manager/index.vue
 * @description 取極め管理コンポーネント
 * @extends AirArrayManager
 *
 * - `AgreementV2` インスタンスの配列を管理するためのコンポーネント。
 * - FireStore への CRUD 操作は行わない、純粋な配列管理 UI コンポーネント。
 *
 * @update 2026-05-09 - `useBaseManager` の `attrs` をシンプルにバインド。
 *                    - `props.modelValue`, `update:modelValue` を削除（定義不要のため）。
 *****************************************************************************/
import { AgreementV2 } from "@/schemas";
import { useDefaults } from "vuetify";
import { useBaseManager } from "@/composables/useBaseManager";
import AgreementInput from "@/components/Agreement/Input/index.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  /**
   * feature/bug-fix-2026-05-09
   * 新規登録時に既定の締日を親コンポーネントから指定できるように機能追加。
   */
  cutoffDate: { type: Number, default: undefined },
  shiftType: { type: String, default: "DAY" },
});
const props = useDefaults(_props, "AgreementsManager");
const emit = defineEmits(["update:shiftType"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("AgreementsManager");

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
/**
 * `AirArrayManager` の `beforeEdit` フック関数。（feature/bug-fix-2026-05-09 で機能追加）
 * - 編集モードに関わらず、編集中のアイテムの `shiftType` を `internalShiftType` に設定する。
 * - 編集モードが "CREATE" で、かつ `props.cutoffDate` が定義されている場合、編集中のアイテムの `cutoffDate` を `props.cutoffDate` に設定する。
 * @param {string} editMode - "CREATE", "UPDATE", "DELETE" のいずれかの文字列で、現在の編集モードを表す。
 * @param {AgreementV2} item - 編集対象の取極め情報インスタンス。`beforeEdit` フックが呼び出される際に、編集中のアイテムがこの引数として渡される。
 * @returns {void}
 */
function beforeEdit(editMode, item) {
  item.shiftType = internalShiftType.value;
  if (editMode === "CREATE" && props.cutoffDate !== undefined) {
    console.log(props.cutoffDate);
    item.cutoffDate = props.cutoffDate;
  }
}
</script>

<template>
  <AirArrayManager
    v-bind="attrs"
    :custom-input="AgreementInput"
    :dialog-props="{ maxWidth: 960 }"
    :schema="AgreementV2"
    item-key="key"
    :error-messages="{
      duplicateKey: '同じ適用開始日で登録された取極めが存在します',
    }"
    :before-edit="beforeEdit"
    @create="($event) => (currentAgreement = $event)"
    @delete="currentAgreement = null"
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
