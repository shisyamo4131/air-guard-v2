<script setup>
/*****************************************************************************
 * @file ./components/Site/Activator/Customer.vue
 * @description 現場の取引先情報表示コンポーネント
 * - `SiteManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "SiteActivatorCustomer");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  return [
    {
      title: "取引先コード",
      props: { subtitle: props.item.customer?.code || "-" },
    },
    {
      title: "取引先名",
      props: {
        subtitle: props.item.customer?.name || props.item.customerName || "-",
      },
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
  includedKeys: ["customerId"],
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
      <air-list v-if="!props.item.isTemporary" :items="items" no-padding />
      <v-empty-state
        v-else
        :title="item.customerName"
        text="取引先未設定の仮登録現場です。"
        action-text="取引先を設定する"
        @click:action="() => emit('click:edit', props.item)"
      />
    </v-card-text>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>
