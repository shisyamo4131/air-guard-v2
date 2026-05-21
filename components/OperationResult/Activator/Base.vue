<script setup>
/*****************************************************************************
 * @file ./components/OperationResult/Activator/Base.vue
 * @description 稼働実績の基本情報表示コンポーネント
 * - `OperationResultManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
// SCHEMAS
import { OperationResult } from "@/schemas";
// COMPOSABLES
import { useConstants } from "@/composables/useConstants";
import { useFetch } from "@/composables/fetch/useFetch";

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  disabled: { type: Boolean, default: false },
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof OperationResult,
  },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "OperationResultActivatorBase");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { DAY_TYPE, SHIFT_TYPE } = useConstants();
const { fetchSiteComposable } = useFetch("OperationResultActivatorBase");
const { cachedSites } = fetchSiteComposable;

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const site = computed(() => {
  return cachedSites.value?.[props.item.siteId] || null;
});
const siteName = computed(() => {
  return site.value?.name || "読み込み中...";
});
const dayTypeTitle = computed(() => {
  return DAY_TYPE.value?.[props.item.dayType]?.title || "N/A";
});
const shiftTypeTitle = computed(() => {
  return SHIFT_TYPE.value?.[props.item.shiftType]?.title || "N/A";
});
const time = computed(() => {
  return `${props.item.startTime} 〜 ${props.item.endTime}`;
});
const breakMinutes = computed(() => {
  return `${props.item.breakMinutes} 分`;
});
const regulationWorkMinutes = computed(() => {
  return `${props.item.regulationWorkMinutes} 分`;
});
const requiredPersonnel = computed(() => {
  return `${props.item.requiredPersonnel} 人`;
});
const items = computed(() => {
  return [
    { title: "現場名", props: { subtitle: siteName.value } },
    { title: "日付", props: { subtitle: props.item.date || "-" } },
    { title: "曜日区分", props: { subtitle: dayTypeTitle.value } },
    { title: "勤務区分", props: { subtitle: shiftTypeTitle.value } },
    { title: "定時時間", props: { subtitle: time.value } },
    { title: "休憩時間", props: { subtitle: breakMinutes.value } },
    { title: "規定労働時間", props: { subtitle: regulationWorkMinutes.value } },
    { title: "必要人数", props: { subtitle: requiredPersonnel.value } },
    {
      title: "作業内容",
      props: { subtitle: props.item.workDescription || "-" },
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
/**
 * OperationResultManager は 原則として CustomInput を使用することになるため
 * Expose が不要。
 */
// defineExpose({
//   includedKeys: ["dateAt", "siteId", "workDescription", "remarks"],
// });
</script>

<template>
  <v-card>
    <v-toolbar color="secondary" density="compact" :title="props.title">
      <template #append>
        <v-btn
          icon="mdi-pencil"
          size="small"
          :disabled="props.disabled"
          @click="emit('click:edit', props.item)"
        />
      </template>
    </v-toolbar>
    <v-card-text class="py-0">
      <air-list :items="items" fluid />
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
