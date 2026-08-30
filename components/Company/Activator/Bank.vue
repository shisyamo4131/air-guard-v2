<script setup>
/*****************************************************************************
 * @file ./components/Company/Activator/Bank.vue
 * @description 会社の口座情報表示コンポーネント
 * - Company振込先editorの表示・起動用コンポーネント
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
  editable: { type: Boolean, default: true },
  title: { type: String, default: "振込先" },
});
const props = useDefaults(_props, "CompanyActivatorBank");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  const billing = Company.getBillingDraftValue(props.item);
  return [
    { title: "金融機関名", props: { subtitle: billing.bankName || "-" } },
    {
      title: "支店名",
      props: { subtitle: billing.branchName || "-" },
    },
    {
      title: "口座種別",
      props: { subtitle: billing.accountType || "-" },
    },
    {
      title: "口座番号",
      props: { subtitle: billing.accountNumber || "-" },
    },
    {
      title: "口座名義",
      props: { subtitle: billing.accountHolder || "-" },
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
    </v-card-text>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>
