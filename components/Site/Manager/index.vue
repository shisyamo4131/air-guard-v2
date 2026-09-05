<script setup>
/*****************************************************************************
 * @file ./components/Site/Manager/index.vue
 * @description 現場管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { useDefaults } from "vuetify";
import CustomInput from "@/components/Site/CustomInput/index.vue";
import { Site } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  beforeEdit: { type: Function, default: () => true },
  doc: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
});
const props = useDefaults(_props, "SiteManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SiteManager");
const { canWrite, isSaving, rejectDirectDelete } = useSiteActions();

function rejectLegacyWrite() {
  throw new Error("現場の編集は操作別エディターから実行してください。");
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
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :before-edit="beforeEdit"
    :disable-submit="disableSubmit"
    :disable-update="disableUpdate"
    :handle-create="rejectLegacyWrite"
    :handle-update="rejectLegacyWrite"
    :handle-delete="handleDelete"
    :custom-input="
      ({ editMode }) => {
        if (editMode === 'CREATE') return CustomInput;
        return null;
      }
    "
  >
    <template #activator="slotProps">
      <slot
        name="activator"
        v-bind="slotProps"
        :can-write="canWrite"
        :is-saving="isSaving"
      />
    </template>

    <template #[`input.customerId`]="{ attrs }">
      <CustomerAutocomplete v-bind="attrs" creatable />
    </template>

    <!-- スロットをパススルー -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot
        :name="slotName"
        v-bind="scope ?? {}"
        :can-write="canWrite"
        :is-saving="isSaving"
      />
    </template>
  </air-item-manager>
</template>
