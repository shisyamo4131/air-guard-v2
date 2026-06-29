<script setup>
/*****************************************************************************
 * @file ./components/OperationResults/Manager/index.vue
 * @description A component to manage `OperationResults` documents.
 * @extends AirArrayManager
 *
 * [NOTE]
 * - 選択された現場に取引先が未設定である場合、確定ボタンを無効化するべきであるが、
 *   `useFetch` コンポーザブルを使う為には `AirArrayManager` の `disableSubmit`
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
  name: "OperationResultsManager",
  inheritAttrs: false,
});

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  customInput: { type: Object, default: () => CustomInput },
  docs: {
    type: Array,
    default: () => [],
    validator: (value) =>
      value.every((item) => item instanceof OperationResult),
  },
  handleCreate: { type: Function, default: handleCreate },
  handleUpdate: { type: Function, default: handleUpdate },
  handleDelete: { type: Function, default: handleDelete },
});
const props = useDefaults(_props, "OperationResultsManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("OperationResultsManager");
</script>

<template>
  <air-array-manager
    v-bind="{ ...$attrs, ...attrs }"
    :model-value="props.docs"
    :schema="OperationResult"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    :custom-input="props.customInput"
    :disable-delete="(item) => item.isLocked"
    :disable-submit="(item) => item.isLocked"
  >
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}"></slot>
    </template>
  </air-array-manager>
</template>
