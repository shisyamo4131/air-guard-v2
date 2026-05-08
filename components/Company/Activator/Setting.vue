<script setup>
/*****************************************************************************
 * @file ./components/Company/Activator/Setting.vue
 * @description 会社の設定情報表示コンポーネント
 * - `CompanyManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Company, RoundSetting } from "@/schemas";
import { useConstants } from "@/composables/useConstants";

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
const props = useDefaults(_props, "CompanyActivatorSetting");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { DAY_OF_WEEK } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const items = computed(() => {
  return [
    {
      title: "時刻選択間隔（分）",
      props: { subtitle: `${props.item.minuteInterval || "-"} 分` },
    },
    {
      title: "端数処理設定",
      props: { subtitle: RoundSetting.label(props.item.roundSetting) || "-" },
    },
    {
      title: "週の開始曜日",
      props: {
        subtitle: DAY_OF_WEEK.value?.[props.item.firstDayOfWeek]?.title || "-",
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
  includedKeys: ["minuteInterval", "roundSetting", "firstDayOfWeek"],
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
      <air-list :items="items" fluid />
    </v-card-text>
    <v-card-actions v-if="$slots.actions">
      <slot name="actions" />
    </v-card-actions>
  </v-card>
</template>
