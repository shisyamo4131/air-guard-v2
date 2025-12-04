<script setup>
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";
import { useCustomerManager } from "@/composables/useCustomerManager";

/** DEFINE PROPS & EMITS */
const props = defineProps({
  fetchCustomerComposable: { type: Object, default: () => useFetchCustomer() },
  creatable: { type: Boolean, default: false },
  label: { type: String, default: "取引先" },
  itemTitle: { type: String, default: "name" },
  itemValue: { type: String, default: "docId" },
  returnObject: { type: Boolean, default: false },
});

const emit = defineEmits(["update:model-value"]);

/** SETUP COMPOSABLES */
const { getCustomer, searchCustomers } = props.fetchCustomerComposable;
const customerManager = useCustomerManager();

function onCreateHandler(event) {
  const emitValue = props.returnObject ? event : event[props.itemValue];
  emit("update:model-value", emitValue);
}
</script>

<template>
  <air-autocomplete-api
    :api="searchCustomers"
    :fetchItemByKeyApi="getCustomer"
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
        v-bind="customerManager.attrs.value"
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
