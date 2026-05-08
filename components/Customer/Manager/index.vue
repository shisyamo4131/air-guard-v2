<script setup>
/*****************************************************************************
 * @file ./components/Customer/Manager/index.vue
 * @description 取引先管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { useDefaults } from "vuetify";
import { Customer } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Customer,
  },
});
const props = useDefaults(_props, "CustomerManager");

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("CustomerManager");
</script>

<template>
  <air-item-manager
    v-bind="attrs"
    :model-value="props.doc"
    :handle-create="(item) => item.create(item)"
    :handle-update="(item) => item.update(item)"
    :handle-delete="(item) => item.delete(item)"
  >
    <!-- スロットをパススルー -->
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-item-manager>
</template>
