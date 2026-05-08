<script setup>
/*****************************************************************************
 * @file ./components/Site/Manager/index.vue
 * @description 現場管理コンポーネント
 * @extends AirItemManager
 *****************************************************************************/
import { useBaseManager } from "@/composables/useBaseManager";
import { useDefaults } from "vuetify";
import CustomInput from "@/components/Site/Input/ToRegist.vue";
import { useFetchCustomer } from "@/composables/fetch/useFetchCustomer";

/*****************************************************************************
 * コンポーネント設定定義
 * title: カードタイトルおよび編集画面タイトル
 * includedKeys: 編集対象プロパティ名の配列
 *****************************************************************************/
const DEFINITION = {
  base: {
    title: "基本情報",
    includedKeys: [
      "code", // 現場コード
      "name", // 現場名
      "nameKana", // 現場名（カナ）
      "zipcode", // 郵便番号
      "prefCode", // 都道府県コード
      "city", // 市区町村
      "address", // 住所
      "building", // 建物名
      "remarks", // 備考
    ],
  },
  customer: {
    title: "取引先情報",
    includedKeys: ["customerId"], // 取引先ID
  },
};

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  doc: { type: Object, required: true },
  title: { type: String, default: undefined },
  type: { type: String, default: "base" },
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
    v-bind="{ ...attrs, ...DEFINITION[props.type] }"
    :handle-create="(item) => item.create(item)"
    :handle-update="(item) => item.update(item)"
    :handle-delete="(item) => item.delete(item)"
    :custom-input="
      ({ editMode }) => {
        if (editMode === 'CREATE') return CustomInput;
        return null;
      }
    "
    :label="props.title || DEFINITION[props.type].title"
  >
    <template #activator="slotProps">
      <slot name="activator" v-bind="slotProps">
        <v-card>
          <v-toolbar
            color="secondary"
            density="compact"
            :title="props.title || DEFINITION[props.type].title"
          >
            <template #append>
              <v-btn
                icon="mdi-pencil"
                size="small"
                @click="() => slotProps.toUpdate()"
              />
            </template>
          </v-toolbar>
          <v-card-text class="py-0">
            <slot name="contents" v-bind="slotProps" />
          </v-card-text>
          <slot name="contents-footer" v-bind="slotProps" />
        </v-card>
      </slot>
    </template>

    <template #[`input.customerId`]="{ attrs }">
      <MoleculesAutocompleteCustomer
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
