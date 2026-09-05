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
  disableSubmit: { type: [Boolean, Function], default: false },
  disableUpdate: { type: [Boolean, Function], default: false },
  doc: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
});
const props = useDefaults(_props, "SiteManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SiteManager");
const { canWrite, isSaving, executeSiteWrite, rejectDirectDelete } =
  useSiteActions();

async function beforeEdit(editMode, item) {
  if (editMode === "DELETE") return await rejectDirectDelete();
  await executeSiteWrite(editMode.toLowerCase(), async () => undefined);
  return await props.beforeEdit(editMode, item);
}

async function handleCreate(item) {
  return await executeSiteWrite("create", () => props.handleCreate(item));
}

async function handleUpdate(item) {
  return await executeSiteWrite("update", () => props.handleUpdate(item));
}

async function handleDelete() {
  return await rejectDirectDelete();
}

function disableSubmit(context) {
  return (
    !canWrite.value ||
    isSaving.value ||
    (typeof props.disableSubmit === "function"
      ? props.disableSubmit(context)
      : props.disableSubmit)
  );
}

function disableUpdate(item) {
  return (
    !canWrite.value ||
    isSaving.value ||
    (typeof props.disableUpdate === "function"
      ? props.disableUpdate(item)
      : props.disableUpdate)
  );
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :before-edit="beforeEdit"
    :disable-submit="disableSubmit"
    :disable-update="disableUpdate"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
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
