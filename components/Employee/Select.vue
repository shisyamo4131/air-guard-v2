<script setup>
/*****************************************************************************
 * @file ./components/Employee/Select.vue
 * @description 従業員用 Select コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "EmployeeSelect", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: "従業員" },
});
const props = useDefaults(_props, "EmployeeSelect");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const enrichedItems = computed(() => {
  return props.items
    .map((item) => {
      const title = `${item.code} - ${item.fullName}`;
      return { ...item, title };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
});
</script>

<template>
  <air-select
    v-bind="$attrs"
    :items="enrichedItems"
    item-title="title"
    item-value="docId"
    :label="props.label"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-select>
</template>
