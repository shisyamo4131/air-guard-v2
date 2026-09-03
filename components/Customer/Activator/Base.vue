<script setup>
/*****************************************************************************
 * @file ./components/Customer/Activator/Base.vue
 * @description 取引先の基本情報表示コンポーネント
 * - Customer基本情報editorの表示コンポーネント
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
  editable: { type: Boolean, default: false },
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
    {
      title: "状態",
      props: {
        subtitle: Object.values(Customer.STATUS).find(
          ({ value }) => value === props.item.contractStatus,
        )?.title || "不明",
      },
    },
  ];
});

</script>

<template>
  <v-card>
    <v-toolbar color="secondary" density="compact" :title="props.title">
      <template v-if="props.editable" #append>
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
