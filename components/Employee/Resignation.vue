<script setup>
/*****************************************************************************
 * @file ./components/Employee/Resignation.vue
 * @description 従業員退職処理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useDocManager } from "@/composables/useDocManager";
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: { type: Object, required: true },
});
const props = useDefaults(_props, "EmployeeResignation");

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, isDev, logger } = useDocManager("EmployeeResignation", {
  doc: props.doc,
});
const { EMPLOYMENT_STATUS } = useConstants();

/*****************************************************************************
 * METHODS
 *****************************************************************************/
/**
 * AirItemManager の beforeEdit フック関数
 * - editMode が "UPDATE" 以外の場合は編集を許可しない
 * - すでに退職済みの従業員に対して退職処理を行うことを許可しない
 * - 上記の条件を満たす場合は、従業員の employmentStatus を "RESIGNED" に変更して編集を許可する
 * @param editMode
 * @param item
 */
function beforeEdit(editMode, item) {
  // 退職処理は更新モードでのみ許可
  if (editMode !== "UPDATE") {
    if (isDev) {
      logger.warn({
        message: "Attempted to edit Employee with unsupported edit mode.",
        data: { editMode, item },
      });
    }
    return false;
  }

  // すでに退職済みの従業員に対して退職処理を行うことを許可しない
  if (item.employmentStatus === EMPLOYMENT_STATUS.value.RESIGNED.value) {
    if (isDev) {
      logger.warn({
        message: "Attempted to terminate an already terminated employee.",
        data: { editMode, item },
      });
    }
    return false;
  }
  item.employmentStatus = EMPLOYMENT_STATUS.value.RESIGNED.value;
  return true;
}

/**
 * AirItemManager の handleUpdate フック関数
 * - `Employee` インスタンスの `toTermination` メソッドを呼び出して、退職処理を実行する
 * - `toTermination` メソッドには、退職日と退職理由を引数として渡す
 *   - インスタンスに設定された `dateOfTermination` と `reasonOfTermination` を使用する
 *   - `toTermination` メソッドの汎用性確保のため
 * @param item
 */
async function handleUpdate(item) {
  await item.toTerminated(item.dateOfTermination, item.reasonOfTermination);
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    hide-delete-btn
    title="退職処理"
    :before-edit="beforeEdit"
    :handle-update="handleUpdate"
  >
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>
    <template #input-default="{ componentAttrs }">
      <v-row>
        <v-col cols="12">
          <air-date-input v-bind="componentAttrs['dateOfHire']" readonly />
        </v-col>
        <v-col cols="12">
          <air-date-input
            v-bind="componentAttrs['dateOfTermination']"
            required
            :rules="[
              (v) =>
                (!!v && v >= componentAttrs['dateOfHire'].modelValue) ||
                '退職日は入社日以降の日付を指定してください。',
            ]"
          />
        </v-col>
        <v-col cols="12">
          <air-text-field
            v-bind="componentAttrs['reasonOfTermination']"
            required
          />
        </v-col>
        <v-col cols="12">
          <v-alert type="warning" density="compact">
            退職処理を行うと、在職中に戻すことはできません。
          </v-alert>
        </v-col>
      </v-row>
    </template>
  </air-item-manager>
</template>
