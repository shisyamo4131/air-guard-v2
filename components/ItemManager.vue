<script setup>
/**
 * @file ItemManager.vue
 *
 * @description AirItemManager をラップしたプロジェクト専用の ItemManager です。
 *              - AirItemManager で発生したエラーに関する処理を定義しています。
 *              - AirItemManager の `handleCreate`, `handleUpdate`, `handleDelete` の処理を
 *                props で定義しています。
 *                - handleCreate: async (item) => await item.create()
 *                - handleUpdate: async (item) => await item.update()
 *                - handleDelete: async (item) => await item.delete()
 *                これらの定義はそれぞれ対応するプロパティで変更することが可能です。
 */
import { useLogger } from "../composables/useLogger";
const logger = useLogger();

defineOptions({ name: "ItemManager" });

const props = defineProps({
  handleCreate: {
    type: Function,
    default: async (item) => await item.create(),
  },
  handleUpdate: {
    type: Function,
    default: async (item) => await item.update(),
  },
  handleDelete: {
    type: Function,
    default: async (item) => await item.delete(),
  },
});

const sender = "ItemManager.vue";

/** useLogger を使用してエラーログを出力する関数 */
function pushError(error) {
  logger.error({
    sender,
    message: error.message,
    error,
  });
}
</script>

<template>
  <air-item-manager
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
    @error="pushError"
    @error:clear="logger.clearError"
  >
    <template #default="slotProps">
      <slot name="default" v-bind="slotProps">
        <v-dialog v-bind="slotProps.dialogProps">
          <template #activator>
            <v-btn icon="mdi-pencil" @click="slotProps.toUpdate()" />
          </template>
          <MoleculesEditCard v-bind="slotProps.editorProps">
            <air-item-input v-bind="slotProps.inputProps" />
          </MoleculesEditCard>
        </v-dialog>
      </slot>
    </template>
  </air-item-manager>
</template>
