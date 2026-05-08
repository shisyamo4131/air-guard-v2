<script setup>
/*****************************************************************************
 * @file ./components/Outsourcer/Autocomplete.vue
 * @description A autocomplete component of 'Outsourcer'.
 *****************************************************************************/
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  fetchOutsourcerComposable: {
    type: Object,
    default: () => useFetchOutsourcer(),
  },
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "外注先" },
  itemTitle: { type: String, default: "displayName" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AutocompleteOutsourcer");
const emit = defineEmits(["update:model-value"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { getOutsourcer, searchOutsourcers, cachedOutsourcersArray } =
  props.fetchOutsourcerComposable;

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onCreateHandler(event) {
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}
</script>

<template>
  <air-autocomplete-api
    :api="searchOutsourcers"
    :fetchItemByKeyApi="getOutsourcer"
    :items="cachedOutsourcersArray"
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
      <OutsourcersManager @create="($event) => onCreateHandler($event)">
        <template #table="{ toCreate }">
          <v-icon @click="toCreate()">mdi-plus</v-icon>
        </template>
      </OutsourcersManager>
    </template>

    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
