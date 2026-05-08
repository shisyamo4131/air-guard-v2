<script setup>
/*****************************************************************************
 * @file ./components/Site/Manager/index.vue
 * @description 現場管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { useDefaults } from "vuetify";
import CustomInput from "@/components/Site/CustomInput/index.vue";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: { type: Object, required: true },
});
const props = useDefaults(_props, "SiteManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("SiteManager");
const fetchCustomerComposable = useFetchCustomer();
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :handle-create="(item) => item.create(item)"
    :handle-update="(item) => item.update(item)"
    :handle-delete="(item) => item.delete(item)"
    :custom-input="
      ({ editMode }) => {
        if (editMode === 'CREATE') return CustomInput;
        return null;
      }
    "
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps" />
    </template>

    <template #[`input.customerId`]="{ attrs }">
      <CustomerAutocomplete
        v-bind="attrs"
        creatable
        :fetch-customer-composable="fetchCustomerComposable"
      />
    </template>

    <!-- スロットをパススルー -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
