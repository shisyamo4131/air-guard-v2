<script setup>
/*****************************************************************************
 * @file ./components/Company/Activator/Bank.vue
 * @description 会社の口座情報表示コンポーネント
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
const props = useDefaults(_props, "CompanyActivatorBank");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  return [
    { title: "金融機関名", props: { subtitle: props.item.bankName || "-" } },
    {
      title: "支店名",
      props: { subtitle: props.item.branchName || "-" },
    },
    {
      title: "口座種別",
      props: { subtitle: props.item.accountType || "-" },
    },
    {
      title: "口座番号",
      props: { subtitle: props.item.accountNumber || "-" },
    },
    {
      title: "口座名義",
      props: { subtitle: props.item.accountHolder || "-" },
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
    "bankName",
    "branchName",
    "accountType",
    "accountNumber",
    "accountHolder",
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
