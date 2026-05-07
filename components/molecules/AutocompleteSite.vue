<script setup>
import { useFetchSite } from "@/composables/fetch/useFetchSite";

/** DEFINE PROPS & EMITS */
const props = defineProps({
  fetchSiteComposable: { type: Object, default: () => useFetchSite() },
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "現場" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});

const emit = defineEmits(["update:model-value"]);

/** SETUP COMPOSABLES */
const { getSite, searchSites, cachedSitesArray } = props.fetchSiteComposable;

function onCreateHandler(event) {
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}
</script>

<template>
  <air-autocomplete-api
    :api="searchSites"
    :fetchItemByKeyApi="getSite"
    :items="cachedSitesArray"
    cache-items
    hint="名称入力で検索"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    persistent-hint
    :return-object="returnObject"
    @update:model-value="emit('update:model-value', $event)"
  >
    <template v-if="creatable" #append>
      <site-manager @create="($event) => onCreateHandler($event)">
        <template #activator="{ toCreate }">
          <v-icon @click="toCreate()">mdi-plus</v-icon>
        </template>
      </site-manager>
    </template>
    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
