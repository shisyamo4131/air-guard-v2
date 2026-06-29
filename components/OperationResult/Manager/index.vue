<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Manager/index.vue
 * @description 稼働実績管理コンポーネント
 * @extends AirItemManager
 *
 * [NOTE]
 * - 選択された現場に取引先が未設定である場合、確定ボタンを無効化するべきであるが、
 *   `useFetch` コンポーザブルを使う為には `AirItemManager` の `disableSubmit`
 *   プロパティが非同期関数をサポートする必要がある。
 *   現状では `OperationResult` クラスが `customerId` 未設定でエラーを投げるため
 *   運用上の問題はなし。
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { OperationResult } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/OperationResult/CustomInput";
import {
  handleCreate,
  handleUpdate,
  handleDelete,
} from "@/handlers/operationResultHandlers";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({
  name: "OperationResultManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  doc: {
    type: Object,
    default: null,
    validator: (value) => value === null || value instanceof OperationResult,
  },
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
});
const props = useDefaults(_props, "OperationResultManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationResultManager");

/*****************************************************************************
 * DEFINE STATES
 *****************************************************************************/
const internalDoc = reactive(new OperationResult());
watch(
  () => props.doc,
  (newDoc) => internalDoc.initialize(newDoc || null),
  { immediate: true, deep: true },
);

/*****************************************************************************
 * TEMPLATE REF
 *****************************************************************************/
const component = useTemplateRef("component");

/*****************************************************************************
 * DEFINE EXPOSE
 *****************************************************************************/
defineExpose({
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
});
</script>

<template>
  <air-item-manager
    v-bind="{ ...$attrs, ...attrs }"
    ref="component"
    :model-value="internalDoc"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :custom-input="props.customInput"
    :disable-delete="(item) => item.isLocked"
    :disable-submit="(item) => item.isLocked"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
