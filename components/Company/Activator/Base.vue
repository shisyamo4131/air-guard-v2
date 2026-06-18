<script setup>
/*****************************************************************************
 * @file ./components/Company/Activator/Base.vue
 * @description 会社の基本情報表示コンポーネント
 * - `CompanyManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Company } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Company,
  },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "CompanyActivatorBase");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedInvoiceNumber = computed(() => {
  return props.item.invoiceNumber ? `T${props.item.invoiceNumber}` : "-";
});

const items = computed(() => {
  return [
    { title: "会社名", props: { subtitle: props.item.companyName || "-" } },
    {
      title: "会社名（カナ）",
      props: { subtitle: props.item.companyNameKana || "-" },
    },
    {
      title: "住所",
      props: { subtitle: props.item.fullAddress || "-" },
    },
    {
      title: "電話番号",
      props: { subtitle: props.item.tel || "-" },
    },
    {
      title: "FAX番号",
      props: { subtitle: props.item.fax || "-" },
    },
    {
      title: "インボイス登録番号",
      props: { subtitle: formattedInvoiceNumber.value },
    },
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
    "companyName",
    "companyNameKana",
    "address",
    "tel",
    "fax",
    "invoiceNumber",
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
    </v-card-text>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>
