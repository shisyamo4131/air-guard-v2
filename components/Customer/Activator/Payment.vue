<script setup>
/*****************************************************************************
 * @file ./components/Customer/Activator/Payment.vue
 * @description 取引先の支払情報表示コンポーネント
 * - `CustomerManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { Customer, CutoffDate } from "@/schemas";
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

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
const props = useDefaults(_props, "CustomerActivatorPayment");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { PAYMENT_MONTH } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const cutoffDateLabel = computed(() => {
  return CutoffDate.getDisplayText(props.item.cutoffDate);
});
const paymentLabel = computed(() => {
  const monthLabel =
    PAYMENT_MONTH.value?.[props.item.paymentMonth]?.title || "-";
  const dayLabel = CutoffDate.getDisplayText(props.item.paymentDate);
  return `${monthLabel}${dayLabel}`;
});
const items = computed(() => {
  return [
    { title: "締日", props: { subtitle: cutoffDateLabel.value || "-" } },
    { title: "入金サイト", props: { subtitle: paymentLabel.value || "-" } },
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
  includedKeys: ["cutoffDate", "paymentMonth", "paymentDate"],
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
