<script setup>
/*****************************************************************************
 * @file ./components/ArrangementNotification/Manager/toLeaved.vue
 * @description A component to manage `ArrangementNotification` document to be `LEAVED`.
 * @extends AirItemManager
 *
 * - 配置通知の状態遷移用コンポーネントであるため、ドキュメントの作成および削除はできません。
 * - 現在の状態が `ARRANGED`, `CONFIRMED` の場合は、編集モードに入らずに次の状態への遷移処理を実行します。
 * - 現在の状態が `ARRIVED`, `LEAVED` の場合は、通常の編集モードに入ります。
 *   状態遷移には `toLeaved()` メソッドが使用されます。
 *****************************************************************************/
import { useConstants } from "@/composables/useConstants";
import { useDefaults } from "vuetify";
import { ArrangementNotification } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
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
  if (
    item.status !== STATUS.value.ARRIVED.value &&
    item.status !== STATUS.value.LEAVED.value
  ) {
    throw new Error(
      "Only ArrangementNotification with ARRIVED or LEAVED status can be updated.",
    );
  }
  await item.toLeaved();
}

/**
 * `AirItemManager` の `handle-delete` フック関数。
 * `ArrangementNotification` ドキュメントの削除は許可されていないため、エラーをスローします。
 */
function handleDelete() {
  throw new Error("Deletion of ArrangementNotification is not allowed.");
}

/**
 * `AirItemManager` の `beforeEdit` フック関数。
 * - 現在の状態が `ARRIVED` または `LEAVED` であれば、そのまま編集モードに入ります。
 * - それ以外の状態であれば編集モードをスキップして、次の状態への遷移処理を実行します。
 * @param editMode
 * @param item
 */
async function beforeEdit(editMode, item) {
  const currentStatus = item.status;
  const editableStatuses = [
    STATUS.value.ARRIVED.value,
    STATUS.value.LEAVED.value,
  ];
  if (editableStatuses.includes(currentStatus)) {
    return true;
  }
  const statusDefinition = STATUS.value?.[currentStatus]?.next;
  if (!statusDefinition) {
    throw new Error(
      "No next status definition found for current status: " + currentStatus,
    );
  }
  const transition = statusDefinition.transition;
  if (!transition) {
    throw new Error(
      "No transition definition found for status: " + currentStatus,
    );
  }
  await item[transition]();
  return false;
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :before-edit="beforeEdit"
    :handle-create="handleCreate"
    :handle-update="handleUpdate"
    :handle-delete="handleDelete"
    hide-delete-btn
  >
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps">
        <ArrangementNotificationChip
          :notification="activatorProps.item"
          :disabled="!activatorProps.item"
          @click="() => activatorProps.toUpdate()"
        />
      </slot>
    </template>
    <template #input-default="{ componentAttrs }">
      <v-row>
        <!-- DATEAT -->
        <v-col cols="12">
          <air-date-input v-bind="componentAttrs[`dateAt`]" disabled />
        </v-col>

        <!-- ACTUAL START TIME -->
        <v-col cols="12">
          <air-time-picker-input v-bind="componentAttrs[`actualStartTime`]" />
        </v-col>

        <!-- ACTUAL IS START NEXT DAY -->
        <v-col cols="12">
          <IsStartNextDayCheckbox
            v-bind="componentAttrs[`actualIsStartNextDay`]"
          />
        </v-col>

        <!-- ACTUAL END TIME -->
        <v-col cols="12">
          <air-time-picker-input v-bind="componentAttrs[`actualEndTime`]" />
        </v-col>

        <!-- ACTUAL BREAK MINUTES -->
        <v-col cols="12">
          <air-number-input v-bind="componentAttrs[`actualBreakMinutes`]" />
        </v-col>
      </v-row>
    </template>
  </air-item-manager>
</template>
