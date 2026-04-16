<script setup>
/*****************************************************************************
 * @file ./components/Sites/Manager/index.vue
 * @description 現場情報管理コンポーネント
 * @author shisyamo4131
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SitesManager");
const emit = defineEmits(["update:search"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs, router } = useBaseManager("SitesManager");
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Site"
    :handle-create="(item) => item.create()"
    :handle-update="(item) => item.update()"
    :handle-delete="(item) => item.delete()"
  >
    <template #table="{ toCreate, items }">
      <v-toolbar class="ps-3 mb-4">
        <AtomsSearchTextField
          :model-value="props.search"
          :delay="300"
          @update:model-value="emit('update:search', $event)"
        />
        <v-btn icon="mdi-plus" @click="() => toCreate()" />
      </v-toolbar>
      <SitesIterator
        class="flex-grow-1"
        grid
        :sites="items"
        :hide-default-footer="props.hideDefaultFooter"
        :items-per-page="props.itemsPerPage"
        :show-create="props.showCreate"
        showDetail
        @click:create="() => toCreate()"
        @click:detail="(item) => router.push(`/sites/${item.docId}`)"
      />
    </template>
    <!-- <template #input-default="props">
      <MoleculesInputsSite v-bind="props" type="default" />
    </template> -->
  </air-array-manager>
</template>
