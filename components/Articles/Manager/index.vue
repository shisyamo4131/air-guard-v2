<script setup>
/*****************************************************************************
 * @file ./components/Articles/Manager/index.vue
 * @description 商品管理コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Article } from "@/schemas";
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
});
const props = useDefaults(_props, "ArticlesManager");
const emit = defineEmits(["update:search"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("ArticlesManager");
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Article"
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
  >
    <template #table="slotProps">
      <slot name="table" v-bind="slotProps">
        <v-toolbar class="ps-3 mb-4">
          <AtomsSearchTextField
            :model-value="props.search"
            :delay="300"
            @update:model-value="emit('update:search', $event)"
          />
          <v-btn icon="mdi-plus" @click="() => slotProps.toCreate()" />
        </v-toolbar>
        <ArticlesIterator
          class="flex-grow-1"
          grid
          :articles="slotProps.items"
          :hide-default-footer="props.hideDefaultFooter"
          :items-per-page="props.itemsPerPage"
          :show-create="props.showCreate"
          showEdit
          @click:create="() => slotProps.toCreate()"
          @click:edit="(item) => slotProps.toUpdate(item)"
        />
      </slot>
    </template>
  </air-array-manager>
</template>
