<script setup>
/*****************************************************************************
 * @file components/Site/Manager/index.vue
 * @description AirItemManagerを使った現場の通常作成・更新コンポーネント
 *****************************************************************************/
import { Site } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CreateInput from "@/components/Site/CustomInput/index.vue";
import BaseInput from "@/components/Site/CustomInput/Base.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  modelValue: {
    type: Object,
    default: () => new Site(),
    validator: (value) => value instanceof Site,
  },
});
const emit = defineEmits(["created", "updated"]);

const { attrs } = useBaseManager("SiteManager");

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
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.modelValue"
    :dialog-props="{
      maxWidth: 480,
      persistent: true,
      scrollable: true,
      'aria-label': $attrs.label,
    }"
    :before-edit="beforeEdit"
    :custom-input="resolveCustomInput"
    disable-delete
    hide-delete-btn
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="rejectDirectDelete"
    @create="emit('created', $event)"
    @update="emit('updated', $event)"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
