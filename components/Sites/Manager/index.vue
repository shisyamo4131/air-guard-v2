<script setup>
/*****************************************************************************
 * @file components/Sites/Manager/index.vue
 * @description AirArrayManagerを使った現場一覧・選択文脈の管理入口
 *****************************************************************************/
import { Site } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CreateInput from "@/components/Site/CustomInput/index.vue";
import BaseInput from "@/components/Site/CustomInput/Base.vue";

defineOptions({ name: "SitesManager", inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  modelValue: {
    type: Array,
    default: () => [],
    validator: (value) => value.every((item) => item instanceof Site),
  },
});

const { attrs } = useBaseManager("SitesManager");

function rejectDirectDelete() {
  throw new Error("現場は直接削除できません。");
}

function resolveCustomInput({ editMode }) {
  if (props.customInput) {
    return typeof props.customInput === "function"
      ? props.customInput({ editMode })
      : props.customInput;
  }
  return editMode === "CREATE" ? CreateInput : BaseInput;
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return rejectDirectDelete();
  if (editMode === "UPDATE" && item.status !== Site.STATUS_ACTIVE) {
    throw new Error("終了済み現場の通常情報は変更できません。");
  }
  return await props.beforeEdit(editMode, item);
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleUpdate(draft) {
  return await draft.update();
}
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    class="fill-height"
    :model-value="props.modelValue"
    :schema="Site"
    label="現場の新規登録"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': '現場の新規登録',
    }"
    :before-edit="beforeEdit"
    :custom-input="resolveCustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectDirectDelete"
  >
    <template #table="tableAttrs">
      <slot name="table" v-bind="tableAttrs" />
    </template>
  </air-array-manager>
</template>
