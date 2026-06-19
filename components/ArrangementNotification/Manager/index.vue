<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/Manager/index.vue
 * @description A component for transitioning the status of arrangement notification.
 * @extends AirItemManager
 * - 管制が配置通知の状態を遷移させるためのコンポーネント。
 * - ドキュメントの作成および削除はできません。
 *****************************************************************************/
import { useConstants } from "@/composables/useConstants";
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/ArrangementNotification/CustomInput/index.vue";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  includesStatus: { type: Boolean, default: false },
  doc: {
    type: Object,
    default: null,
    validator: (v) => v === null || v instanceof ArrangementNotification,
  },
});
const props = useDefaults(_props, "ArrangementNotificationManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("ArrangementNotification");
const { ARRANGEMENT_NOTIFICATION_STATUS: STATUS } = useConstants();
const component = useTemplateRef("component");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalDoc = reactive(new ArrangementNotification());
watch(
  () => props.doc,
  (newDoc) => internalDoc.initialize(newDoc || null),
  { immediate: true, deep: true },
);

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * `AirItemManager` の `handle-create` フック関数。
 * `ArrangementNotification` ドキュメントの新規作成は許可されていないため、エラーをスローします。
 */
function handleCreate() {
  throw new Error("Creation of ArrangementNotification is not allowed.");
}

/**
 * `AirItemManager` の `handle-update` フック関数。
 * - 更新対象のドキュメントの状態が `ARRIVED` または `LEAVED` であることを確認します。
 * - 条件を満たす場合は `toLeaved()` メソッドを呼び出して、ドキュメントの状態を `LEAVED` に遷移させます。
 * - 条件を満たさない場合はエラーをスローします。
 * @param item
 */
async function handleUpdate(item) {
  if (item.status === STATUS.value.ARRANGED.value) {
    await item.toArranged();
  }
  if (item.status === STATUS.value.CONFIRMED.value) {
    await item.toConfirmed();
  }
  if (item.status === STATUS.value.ARRIVED.value) {
    await item.toArrived();
  }
  if (item.status === STATUS.value.LEAVED.value) {
    await item.toLeaved();
  }
}

/**
 * `AirItemManager` の `handle-delete` フック関数。
 * `ArrangementNotification` ドキュメントの削除は許可されていないため、エラーをスローします。
 */
function handleDelete() {
  throw new Error("Deletion of ArrangementNotification is not allowed.");
}

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
});
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    ref="component"
    :model-value="internalDoc"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    hide-delete-btn
    :custom-input="props.customInput"
    :input-props="{
      includesStatus: props.includesStatus,
    }"
    :dialog-props="{ maxWidth: 372 }"
  >
    <!-- スロットをパススルー -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
