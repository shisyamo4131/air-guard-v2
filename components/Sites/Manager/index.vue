<script setup>
/*****************************************************************************
 * @file ./components/Sites/Manager/index.vue
 * @description 現場情報管理コンポーネント
 * @extends AirArrayManager
 *
 * - 新規登録時は `@/components/Site/CustomInput/index.vue` を使用してステップ入力を行います。
 * - 更新時には `@/components/Site/CustomInput/Base.vue` を使用するため、基本情報の更新のみを行うことが可能です。
 *   `props.customInput` を使用することで、更新時のカスタム入力コンポーネントを差し替えることができます。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/Site/CustomInput/index.vue"; // 新規登録時のカスタム入力コンポーネント
import CustomInputBase from "@/components/Site/CustomInput/Base.vue"; // 更新時のカスタム入力コンポーネント

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "SitesManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: Object, default: () => CustomInputBase },
  docs: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "SitesManager");

/*****************************************************************************
 * SETUP BASE MANAGER COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SitesManager");
const { canWrite, isSaving, rejectDirectDelete } = useSiteActions();

function rejectLegacyWrite() {
  throw new Error("現場の編集は操作別エディターから実行してください。");
}

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * AirArrayManager に適用すべきカスタム入力コンポーネントを返します。
 * @param {string} editMode - 編集モード
 * @returns {Object} - 適用すべきカスタム入力コンポーネント
 */
function getApplicableCustomInput({ editMode }) {
  if (editMode === "CREATE") return CustomInput;
  return props.customInput;
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return await rejectDirectDelete();
  if (editMode === "CREATE" || editMode === "UPDATE") rejectLegacyWrite();
  return await props.beforeEdit(editMode, item);
}

async function handleDelete() {
  return await rejectDirectDelete();
}

function disableSubmit() {
  return true;
}

function disableUpdate() {
  return true;
}
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="docs"
    :schema="Site"
    :before-edit="beforeEdit"
    :disable-submit="disableSubmit"
    :disable-update="disableUpdate"
    :handle-create="rejectLegacyWrite"
    :handle-update="rejectLegacyWrite"
    :handle-delete="handleDelete"
    :custom-input="getApplicableCustomInput"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot
        :name="slotName"
        v-bind="scope ?? {}"
        :can-write="canWrite"
        :is-saving="isSaving"
      ></slot>
    </template>
  </air-array-manager>
</template>
