<script setup>
/*****************************************************************************
 * @file ./components/Customer/Activator/Payment.vue
 * @description 取引先の支払情報表示コンポーネント
 * - Customer支払条件editorの表示コンポーネント
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
  editable: { type: Boolean, default: false },
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
