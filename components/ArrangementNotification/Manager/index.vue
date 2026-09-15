<script setup>
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";
import CustomInput from "@/components/ArrangementNotification/CustomInput/index.vue";
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "ArrangementNotificationManager", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  doc: {
    type: Object,
    default: null,
    validator: (value) =>
      value === null || value instanceof ArrangementNotification,
  },
  customInput: { type: Object, default: () => CustomInput },
  includesStatus: { type: Boolean, default: false },
  beforeEdit: { type: Function, default: null },
});
const props = useDefaults(_props, "ArrangementNotificationManager");
const emit = defineEmits(["submit:complete"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("ArrangementNotificationManager");
const manager = useTemplateRef("manager");
const internalDoc = reactive(new ArrangementNotification());
const hasValidDoc = computed(
  () => props.doc instanceof ArrangementNotification && Boolean(props.doc.docId),
);

/*****************************************************************************
 * WATCHERS
 *****************************************************************************/
watch(
  () => props.doc,
  (doc) => internalDoc.initialize(doc || null),
  { immediate: true, deep: true },
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function rejectUnsupportedOperation() {
  throw new Error("この画面では指定された配置通知操作を実行できません。");
}

async function beforeEdit(editMode, item) {
  if (editMode !== "UPDATE") return rejectUnsupportedOperation();
  return props.beforeEdit ? props.beforeEdit(editMode, item) : true;
}

async function handleUpdate(item) {
  return await item.update();
}

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
function toUpdate(item = props.doc) {
  if (!(item instanceof ArrangementNotification) || !item.docId) return false;
  return manager.value?.toUpdate(item) ?? false;
}
defineExpose({ toUpdate });
</script>

<template>
  <air-item-manager
    ref="manager"
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="internalDoc"
    :custom-input="props.customInput"
    :input-props="{ includesStatus: props.includesStatus }"
    :dialog-props="{ maxWidth: 480, persistent: true, scrollable: true }"
    :before-edit="beforeEdit"
    disable-delete
    hide-delete-btn
    :handle-create="rejectUnsupportedOperation"
    :handle-update="handleUpdate"
    :handle-delete="rejectUnsupportedOperation"
    @submit:complete="emit('submit:complete', $event.item)"
  >
    <template #activator="slotProps">
      <slot
        name="activator"
        v-bind="{
          ...slotProps,
          disabled: slotProps.disableUpdate || !hasValidDoc,
        }"
      />
    </template>
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot v-if="name !== 'activator'" :name="name" v-bind="scope || {}" />
    </template>
  </air-item-manager>
</template>
