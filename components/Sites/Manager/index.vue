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
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInputBase },
  docs: { type: Array, default: () => [] },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
});
const props = useDefaults(_props, "SitesManager");

/*****************************************************************************
 * SETUP BASE MANAGER COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SitesManager");

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
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Site"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :custom-input="getApplicableCustomInput"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-array-manager>
</template>
