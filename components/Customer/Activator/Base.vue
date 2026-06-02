<script setup>
/*****************************************************************************
 * @file ./components/Customer/Activator/Base.vue
 * @description 取引先の基本情報表示コンポーネント
 * - `CustomerManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { Customer } from "@/schemas";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Customer,
  },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "CustomerActivatorBase");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  return [
    { title: "取引先コード", props: { subtitle: props.item.code || "-" } },
    { title: "取引先名", props: { subtitle: props.item.name || "-" } },
    {
      title: "支店名など",
      props: { subtitle: props.item.branchName || "-" },
    },
    {
      title: "略称",
      props: { subtitle: props.item.abbreviation || "-" },
    },
    {
      title: "略称（カナ）",
      props: { subtitle: props.item.nameKana || "-" },
    },
    { title: "郵便番号", props: { subtitle: props.item.zipcode || "-" } },
    { title: "住所", props: { subtitle: props.item.fullAddress || "-" } },
    { title: "建物名", props: { subtitle: props.item.building || "-" } },
    { title: "電話番号", props: { subtitle: props.item.tel || "-" } },
    { title: "FAX番号", props: { subtitle: props.item.fax || "-" } },
    { title: "状態", props: { subtitle: props.item.contractStatus || "-" } },
  ];
});

/*****************************************************************************
 * EXPOSE
 * - 当該コンポーネントを利用する AirItemManager, AirArrayManager の入力プロパティを
 *   定める。
 * - includedKeys: 編集対象プロパティ名の配列
 * - excludedKeys: 編集対象外プロパティ名の配列
 * - includedKeys と excludedKeys の両方が指定された場合、includedKeys が優先される
 *****************************************************************************/
defineExpose({
  includedKeys: [
    "code",
    "name",
    "branchName",
    "abbreviation",
    "nameKana",
    "zipcode",
    "prefCode",
    "city",
    "building",
    "tel",
    "fax",
    "remarks",
  ],
});
</script>

<template>
  <v-card>
    <v-toolbar color="secondary" density="compact" :title="props.title">
      <template #append>
        <v-btn
          icon="mdi-pencil"
          size="small"
          @click="emit('click:edit', props.item)"
        />
      </template>
    </v-toolbar>
    <v-card-text class="py-0">
      <air-list :items="items" no-padding />
      <air-textarea
        label="備考"
        :model-value="props.item.remarks"
        variant="outlined"
        readonly
      />
    </v-card-text>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>
