<script setup>
/*****************************************************************************
 * @file components/Site/Manager/index.vue
 * @description AirItemManagerを使った現場の通常CRUD・明示的アーカイブコンポーネント
 *****************************************************************************/
import { Site } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CreateInput from "@/components/Site/CustomInput/index.vue";
import BaseInput from "@/components/Site/CustomInput/Base.vue";
import { ref } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  customInput: { type: [Object, Function], default: null },
  lifecycleMode: { type: String, default: null },
  archiveMode: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    default: () => new Site(),
    validator: (value) => value instanceof Site,
  },
});
const emit = defineEmits(["created", "updated", "delete"]);
const manager = ref(null);

const { attrs } = useBaseManager("SiteManager");

function resolveCustomInput({ editMode }) {
  if (props.customInput) {
    return typeof props.customInput === "function"
      ? props.customInput({ editMode })
      : props.customInput;
  }
  return editMode === "CREATE" ? CreateInput : BaseInput;
}

function updateProperties(changes) {
  manager.value?.updateProperties(changes);
}

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE" && !props.archiveMode) {
    throw new Error("現場のアーカイブは詳細画面から実行してください。");
  }
  if (editMode === "UPDATE" && props.lifecycleMode === "TERMINATE") {
    if (item.status !== Site.STATUS_ACTIVE) throw new Error("稼働中の現場だけ終了できます。");
    item.status = Site.STATUS_TERMINATED;
    item.statusChangeSource = "MANUAL";
    item.statusChangeReason = "";
  }
  if (editMode === "UPDATE" && props.lifecycleMode === "REACTIVATE") {
    if (item.status !== Site.STATUS_TERMINATED) throw new Error("終了済み現場だけ再有効化できます。");
    item.status = Site.STATUS_ACTIVE;
    item.statusChangeSource = "REACTIVATION";
    item.statusChangeReason = "";
  }
  if (editMode === "UPDATE" && !props.lifecycleMode && item.status !== Site.STATUS_ACTIVE) {
    throw new Error("終了済み現場の通常情報は変更できません。");
  }
  return await props.beforeEdit(editMode, item);
}

async function handleCreate(draft) {
  return await draft.create();
}

async function handleUpdate(draft) {
  if (props.lifecycleMode) {
    const { $auth } = useNuxtApp();
    draft.statusChangedAt = new Date();
    draft.statusChangedBy = $auth?.currentUser?.uid || "";
    draft.statusChangeReason = draft.statusChangeReason?.trim?.() || "";
  }
  return await draft.update();
}

async function handleDelete(draft) {
  return await draft.delete();
}
</script>

<template>
  <air-item-manager
    ref="manager"
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
    :disable-delete="!props.archiveMode"
    :hide-delete-btn="!props.archiveMode"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    @create="emit('created', $event)"
    @update="emit('updated', $event)"
    @delete="emit('delete', $event)"
  >
    <template #input-default="inputAttrs">
      <component
        :is="resolveCustomInput({ editMode: inputAttrs.editMode })"
        v-bind="{ ...inputAttrs, updateProperties }"
      />
    </template>
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>
  </air-item-manager>
</template>
