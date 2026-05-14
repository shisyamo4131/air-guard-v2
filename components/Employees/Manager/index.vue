<script setup>
/*****************************************************************************
 * @file ./components/Employees/Manager/index.vue
 * @description 従業員情報管理コンポーネント
 * @author shisyamo4131
 *
 * @emits update:search - 検索クエリの更新を親コンポーネントに通知
 * @emits click:detail - 従業員アイテムがクリックされたことを親コンポーネントに通知
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Employee } from "@/schemas";
import { useBaseManager } from "@/composables/useBaseManager";
import CustomInput from "@/components/Employee/CustomInput/ToRegist.vue";

// feature/code-autonumber
// Employee クラスの useAutonumber プロパティを直接変更
Employee.useAutonumber = {
  field: "code",
  length: 4,
  prefix: "EMP",
};

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  docs: { type: Array, default: () => [] },
  handleCreate: { type: Function, default: (item) => item.create(item) },
  handleUpdate: { type: Function, default: (item) => item.update(item) },
  handleDelete: { type: Function, default: (item) => item.delete(item) },
  hideDefaultFooter: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 5 },
  search: { type: String, default: null },
  showCreate: { type: Boolean, default: false },
  sortBy: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "EmployeesManager");
const emit = defineEmits(["update:search", "click:detail"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { attrs } = useBaseManager("EmployeesManager");
</script>

<template>
  <air-array-manager
    v-bind="attrs"
    :model-value="docs"
    :schema="Employee"
    :custom-input="
      ({ editMode }) => {
        if (editMode === 'CREATE') return CustomInput;
        return null;
      }
    "
    :handle-create="props.handleCreate"
    :handle-update="props.handleUpdate"
    :handle-delete="props.handleDelete"
  >
    <template #table="slotProps">
      <slot name="table" v-bind="slotProps">
        <v-toolbar class="ps-3 mb-4">
          <AtomsSearchTextField
            :model-value="props.search"
            :delay="300"
            @update:model-value="emit('update:search', $event)"
          />
          <v-btn icon="mdi-plus" @click="() => slotProps.toCreate()" />
        </v-toolbar>
        <EmployeesIterator
          class="flex-grow-1"
          grid
          :employees="slotProps.items"
          :hide-default-footer="props.hideDefaultFooter"
          :items-per-page="props.itemsPerPage"
          :show-create="props.showCreate"
          showDetail
          :sort-by="props.sortBy"
          @click:create="() => slotProps.toCreate()"
          @click:detail="(item) => emit('click:detail', item)"
        />
      </slot>
    </template>
  </air-array-manager>
</template>
