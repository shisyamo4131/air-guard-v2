<script setup>
/*****************************************************************************
 * @file ./components/Outsourcer/Autocomplete.vue
 * @description A autocomplete component of 'Outsourcer'.
 *
 * @note
 * `AutocompleteApi` に対する設定は以下のようにする。
 * - `fetchXxxComposable` が提供する検索APIを `api` に渡す。
 * - 検索と検索結果のキャッシュは `fetchXxxComposable` に任せる。
 * - `custom-filter` は常に `true` を返すようにする。
 *   -> `Autocomplete` 自体のフィルタリングによって実際に入力された文字列で検索結果が
 *      絞り込まれてしまう為、内部で使用している N-gram 検索と競合してしまうため。
 * - `cache-items` は使用しない。
 *   -> `cache-items` は `AirApiLoader` が検索結果をキャッシュするためのもので
 *      これを `true` にすると、検索結果とキャッシュされたアイテムがマージされ、
 *      `Autocomplete` の `items` に引き渡されてしまい、`custom-filter` が常に `true` を
 *      返す設定と競合してしまうため。
 *      つまりは、検索結果のみが `Autocomplete` の `items` に引き渡されるようにしなければならない。
 * なお、N-gram による検索結果は `fetchXxxComposable` 自体がキャッシュしてくれるので
 * 検索APIを呼び出すたびに N-gram による検索が走ることはない。
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
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
const { fetchOutsourcerComposable } = useFetch("OutsourcerAutocomplete");
const { getOutsourcer, searchOutsourcers } = fetchOutsourcerComposable;

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
    :custom-filter="() => true"
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
