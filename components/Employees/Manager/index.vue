<script setup>
/*****************************************************************************
 * @file ./components/Employees/Manager/index.vue
 * @description 従業員情報管理コンポーネント
 * @author shisyamo4131
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Employee } from "@/schemas";

const _props = defineProps({
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  showCreate: { type: Boolean, default: false },
});
const props = useDefaults(_props, "EmployeesManager");
</script>

<template>
  <air-array-manager :schema="Employee">
    <template #table="{ items, toCreate }">
      <v-card class="d-flex flex-column fill-height" title="従業員管理">
        <template v-if="props.showCreate" #append>
          <v-btn
            icon="mdi-plus"
            color="primary"
            variant="text"
            @click="toCreate"
          />
        </template>
        <v-card-text class="overflow-hidden">
          <EmployeesIterator
            :employees="items"
            :hide-default-footer="props.hideDefaultFooter"
            :items-per-page="props.itemsPerPage"
            :show-create="props.showCreate"
            showEdit
            showDetail
          />
        </v-card-text>
      </v-card>
    </template>
    <template #input-default="props">
      <MoleculesInputsEmployee v-bind="props" type="default" />
    </template>
  </air-array-manager>
</template>
