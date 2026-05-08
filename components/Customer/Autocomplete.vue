<script setup>
/*****************************************************************************
 * @file ./components/Customer/Autocomplete.vue
 * @description A autocomplete component of 'Customer'.
 *****************************************************************************/
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  fetchCustomerComposable: { type: Object, default: () => useFetchCustomer() },
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "取引先" },
  itemTitle: { type: String, default: "abbreviation" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});
const props = useDefaults(_props, "AutocompleteCustomer");
const emit = defineEmits(["update:model-value"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { getCustomer, searchCustomers, cachedCustomersArray } =
  props.fetchCustomerComposable;

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
    :api="searchCustomers"
    :fetchItemByKeyApi="getCustomer"
    :items="cachedCustomersArray"
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
      <CustomersManager @create="($event) => onCreateHandler($event)">
        <template #table="{ toCreate }">
          <v-icon @click="toCreate()">mdi-plus</v-icon>
        </template>
      </CustomersManager>
    </template>

    <!-- スロットのパススルー -->
    <template v-for="(slotFn, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}"></slot>
    </template>
  </air-autocomplete-api>
</template>
