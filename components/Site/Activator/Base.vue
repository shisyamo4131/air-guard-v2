<script setup>
/*****************************************************************************
 * @file ./components/Site/Activator/Base.vue
 * @description 現場の基本情報表示コンポーネント
 * - `SiteManager` の activator スロット用コンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { Site } from "@/schemas";
import { useConstants } from "@/composables/useConstants";
import dayjs from "dayjs";
import CustomInput from "@/components/Site/CustomInput/Base.vue";

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
const props = useDefaults(_props, "SiteActivatorBase");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { SECURITY_TYPE } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const securityTypeTitle = computed(() => {
  return SECURITY_TYPE.value?.[props.item.securityType]?.title || "N/A";
});

/**
 * 工事期間の表示用文字列を生成する算出プロパティ
 * - 開始日と終了日の両方が存在する場合は "YYYY/MM/DD 〜 YYYY/MM/DD" の形式で表示
 * - どちらか一方が存在しない場合は存在する方の日付を表示
 * - 両方とも存在しない場合は "-" を表示
 */
const constructionPeriod = computed(() => {
  const start = props.item.constructionPeriodStartAt
    ? dayjs(props.item.constructionPeriodStartAt)
        .tz("Asia/Tokyo")
        .format("YYYY/MM/DD")
    : null;
  const end = props.item.constructionPeriodEndAt
    ? dayjs(props.item.constructionPeriodEndAt)
        .tz("Asia/Tokyo")
        .format("YYYY/MM/DD")
    : null;

  if (!start && !end) return "-";
  return `${start} 〜 ${end}`;
});
const items = computed(() => {
  return [
    { title: "現場コード", props: { subtitle: props.item.code || "-" } },
    { title: "現場名", props: { subtitle: props.item.name || "-" } },
    {
      title: "現場名（カナ）",
      props: { subtitle: props.item.nameKana || "-" },
    },
    { title: "郵便番号", props: { subtitle: props.item.zipcode || "-" } },
    { title: "住所", props: { subtitle: props.item.fullAddress || "-" } },
    { title: "建物名", props: { subtitle: props.item.building || "-" } },
    { title: "警備種別", props: { subtitle: securityTypeTitle.value } },
    { title: "現場番号", props: { subtitle: props.item.siteNumber || "-" } },
    { title: "工事期間", props: { subtitle: constructionPeriod.value } },
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
  // includedKeys: [
  //   "code",
  //   "name",
  //   "nameKana",
  //   "zipcode",
  //   "prefCode",
  //   "city",
  //   "address",
  //   "building",
  //   "securityType",
  //   "siteNumber",
  //   "constructionPeriodStartAt",
  //   "constructionPeriodEndAt",
  //   "remarks",
  // ],
  customInput: CustomInput,
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
