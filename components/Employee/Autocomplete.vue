<script setup>
import { useFetch } from "@/composables/fetch/useFetch";
import { useDefaults } from "vuetify";

defineOptions({ inheritAttrs: false });
const props = useDefaults(defineProps({
  modelValue: { type: [String, Object], default: null }, creatable: { type: Boolean, default: false },
  label: { type: String, default: "従業員" }, itemTitle: { type: String, default: "displayName" },
  itemValue: { type: String, default: "docId" }, returnObject: { type: Boolean, default: false }, delay: { type: Number, default: 500 },
}), "AutocompleteEmployee");
const emit = defineEmits(["update:model-value", "update:search"]);
const { fetchEmployeeComposable: reader } = useFetch("EmployeeAutocomplete");
const search = ref(""), requestedSearch = ref(""); let timer;
const selectedId = computed(() => typeof props.modelValue === "object" ? props.modelValue?.[props.itemValue] : props.modelValue);
const selected = computed(() => reader.canRead.value ? reader.cachedEmployees.value[selectedId.value] || null : null);
const model = computed(() => selected.value ? (props.returnObject ? selected.value : selected.value[props.itemValue]) : null);
const items = computed(() => {
  if (!reader.canRead.value) return [];
  const matches = reader.searchResults(requestedSearch.value, { returnAllCached: false });
  return selected.value && !matches.some((item) => item.docId === selected.value.docId) ? [selected.value, ...matches] : matches;
});
watch(() => [selectedId.value, reader.scope.value, reader.canRead.value], () => { if (reader.canRead.value && selectedId.value) void reader.fetchEmployee(selectedId.value); }, { immediate: true });
watch(() => reader.generation.value, () => { clearTimeout(timer); search.value = ""; requestedSearch.value = ""; });
watch(search, (value) => {
  clearTimeout(timer); emit("update:search", value);
  if (!value || !reader.canRead.value) { requestedSearch.value = ""; return; }
  const source = reader.captureScope();
  timer = setTimeout(() => { if (!reader.isCurrent(source)) return; requestedSearch.value = value; void reader.searchEmployees(value, { returnAllCached: false }); }, props.delay);
});
onScopeDispose(() => clearTimeout(timer));
</script>
<template>
  <v-autocomplete v-bind="$attrs" :key="reader.generation.value" :model-value="model" v-model:search="search"
    :items="items" :item-title="itemTitle" :item-value="itemValue" :return-object="returnObject"
    :label="label" :custom-filter="() => true" hide-selected :loading="reader.isLoading.value"
    :disabled="!reader.canRead.value || $attrs.disabled" :error-messages="reader.error.value"
    hint="名称入力で検索" persistent-hint @update:model-value="emit('update:model-value', $event)">
    <template #item="slotProps"><slot name="item" v-bind="slotProps"><EmployeeListItem v-bind="slotProps.props" :item="slotProps.item" /></slot></template>
    <template v-for="(_, name) in Object.fromEntries(Object.entries($slots).filter(([key]) => key !== 'item' && key !== 'append'))" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
  </v-autocomplete>
</template>
