<script setup>
/*****************************************************************************
 * @file ./components/Customers/Manager/index.vue
 * @description 取引先情報管理コンポーネント
 * @author shisyamo4131
 *
 * @emits update:search - 検索クエリの更新を親コンポーネントに通知
 * @emits click:detail - 取引先アイテムがクリックされたことを親コンポーネントに通知
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Customer } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
  sortBy: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "CustomersManager");
const emit = defineEmits(["update:search", "click:detail"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("CustomersManager");
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Customer"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
  >
    <template #table="tableProps">
      <slot name="table" v-bind="tableProps">
        <v-toolbar class="ps-3 mb-4">
          <AtomsSearchTextField
            :model-value="props.search"
            :delay="300"
            @update:model-value="emit('update:search', $event)"
          />
          <v-btn icon="mdi-plus" @click="() => tableProps.toCreate()" />
        </v-toolbar>
        <CustomersIterator
          class="flex-grow-1"
          grid
          :min-column-width="300"
          :customers="tableProps.items"
          :hide-default-footer="props.hideDefaultFooter"
          :items-per-page="props.itemsPerPage"
          :show-create="props.showCreate"
          :sort-by="props.sortBy"
          showDetail
          @click:create="() => tableProps.toCreate()"
          @click:detail="(item) => emit('click:detail', item)"
        />
      </slot>
    </template>
  </air-array-manager>
</template>
