<script setup>
/*****************************************************************************
 * @file ./components/Sites/Manager/index.vue
 * @description 現場情報管理コンポーネント
 * @author shisyamo4131
 *
 * @emits update:search - 検索クエリの更新を親コンポーネントに通知
 * @emits click:detail - 現場アイテムがクリックされたことを親コンポーネントに通知
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/Site/CustomInput/index.vue";

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
const props = useDefaults(_props, "SitesManager");
const emit = defineEmits(["update:search", "click:detail"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SitesManager");
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Site"
    :custom-input="
      ({ editMode }) => {
        if (editMode === 'CREATE') return CustomInput;
        return null;
      }
    "
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
        <SitesIterator
          class="flex-grow-1"
          grid
          :sites="slotProps.items"
          :hide-default-footer="props.hideDefaultFooter"
          :items-per-page="props.itemsPerPage"
          :show-create="props.showCreate"
          showDetail
          @click:create="() => slotProps.toCreate()"
          @click:detail="(item) => emit('click:detail', item)"
        />
      </slot>
    </template>
  </air-array-manager>
</template>
