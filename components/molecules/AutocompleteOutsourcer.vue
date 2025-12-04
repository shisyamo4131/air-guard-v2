<script setup>
import { useFetchOutsourcer } from "@/composables/fetch/useFetchOutsourcer";
import { useOutsourcerManager } from "@/composables/useOutsourcerManager";

/** DEFINE PROPS & EMITS */
const props = defineProps({
  fetchOutsourcerComposable: {
    type: Object,
    default: () => useFetchOutsourcer(),
  },
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "外注先" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});

const emit = defineEmits(["update:model-value"]);

/** SETUP COMPOSABLES */
const { getOutsourcer, searchOutsourcers } = props.fetchOutsourcerComposable;
const outsourcerManager = useOutsourcerManager();

function onCreateHandler(event) {
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}
</script>

<template>
  <air-autocomplete-api
    :api="searchOutsourcers"
    :fetchItemByKeyApi="getOutsourcer"
    hint="名称入力で検索"
    :item-title="itemTitle"
    :item-value="itemValue"
    :label="label"
    persistent-hint
    :return-object="returnObject"
    @update:model-value="emit('update:model-value', $event)"
  >
    <template v-if="creatable" #append>
      <air-item-manager
        v-bind="outsourcerManager.attrs.value"
        @create="($event) => onCreateHandler($event)"
      >
        <template #default="{ toCreate }">
          <v-icon @click="toCreate()">mdi-plus</v-icon>
        </template>
      </air-item-manager>
    </template>
    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
