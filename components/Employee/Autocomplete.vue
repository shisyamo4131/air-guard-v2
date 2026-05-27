<script setup>
/*****************************************************************************
 * @file ./components/Employee/Autocomplete.vue
 * @description A autocomplete component of 'Employee'.
 *
 * @note
 * `air-autocomplete-api` に対する設定は以下のようにする。
 *
 * - `api` には `fetchXxxComposable` が提供する検索APIをラップした関数を渡す。
 *   -> `AirApiLoader` は `api` を呼び出す際に検索文字列のみを渡すため、
 *      オプションを固定したラッパー関数を用意する必要がある。
 *   -> オプション `returnAllCached: false` を指定すること。
 *      指定しない場合（デフォルト `true`）、過去の検索結果がキャッシュから混入し、
 *      後述の `custom-filter: () => true` と組み合わさって意図しないアイテムが
 *      選択肢に表示されてしまう。
 *
 * - `custom-filter` は常に `true` を返すようにする。
 *   -> Vuetify の `v-autocomplete` がクライアント側でさらに絞り込みを行うため、
 *      N-gram 検索の結果と競合してしまう。フィルタリングは N-gram 検索に完全に委ねる。
 *
 * - `cache-items` は使用しない（デフォルトのまま `false`）。
 *   -> `true` にすると `AirApiLoader` が検索結果を累積キャッシュし、それが
 *      `custom-filter: () => true` と競合して意図しないアイテムが表示される。
 *      `items` には常に直近の検索結果のみが渡るようにすること。
 *
 * なお、同一クエリへの N-gram 再検索は `fetchXxxComposable` の検索キャッシュが
 * 吸収するため、`api` が呼ばれるたびに Firestore へアクセスされるわけではない。
 *****************************************************************************/
import { useFetch } from "@/composables/fetch/useFetch";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "従業員" },
  itemTitle: { type: String, default: "displayName" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AutocompleteEmployee");
const emit = defineEmits(["update:model-value"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { fetchEmployeeComposable } = useFetch("EmployeeAutocomplete");
const { getEmployee, searchEmployees } = fetchEmployeeComposable;

/*****************************************************************************
 * METHODS
 *****************************************************************************/
function onCreateHandler(event) {
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}

async function api(text) {
  return await searchEmployees(text, { returnAllCached: false });
}
</script>

<template>
  <air-autocomplete-api
    :api="api"
    :fetchItemByKeyApi="getEmployee"
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
      <EmployeeManager @create="($event) => onCreateHandler($event)">
        <template #table="{ toCreate }">
          <v-icon @click="toCreate()">mdi-plus</v-icon>
        </template>
      </EmployeeManager>
    </template>

    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
