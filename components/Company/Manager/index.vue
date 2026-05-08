<script setup>
/*****************************************************************************
 * @file ./components/Company/Manager/index.vue
 * @description 会社管理コンポーネント
 * - 会社情報はアプリ側から作成できないため、handle-create ハンドラーではエラーがスローされます。
 * - 会社情報はアプリ側から削除できないため、hide-delete-btn が true に固定され、
 *   handle-delete ハンドラーではエラーがスローされます。
 * @extends AirItemManager
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: { type: Object, required: true },
});
const props = useDefaults(_props, "CompanyManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("CompanyManager");

/*****************************************************************************
 * FUNCTIONS
 *****************************************************************************/
/**
 * 会社情報の作成はできないため、エラーをスローするハンドラー
 * @throws {Error} 会社情報の作成はできないことを示す
 */
function handleCreate() {
  throw new Error("会社情報の作成はできません。");
}

/**
 * 会社情報の削除はできないため、エラーをスローするハンドラー
 * @throws {Error} 会社情報の削除はできないことを示す
 */
function handleDelete() {
  throw new Error("会社情報の削除はできません。");
}
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :handle-create="handleCreate"
    :handle-update="(item) => item.update(item)"
    :handle-delete="handleDelete"
    hide-delete-btn
  >
    <template #activator="activatorProps">
      <slot name="activator" v-bind="activatorProps" />
    </template>

    <!-- スロットをパススルー -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
