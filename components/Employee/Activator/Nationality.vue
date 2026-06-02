<script setup>
/*****************************************************************************
 * @file ./components/Employee/Activator/Nationality.vue
 * @description 従業員の国籍情報表示コンポーネント
 * - `EmployeeManager` の activator スロット用コンポーネント
 *****************************************************************************/
import dayjs from "dayjs";
import { Employee } from "@/schemas";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  item: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Employee,
  },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "EmployeeActivatorNationality");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedPeriodOfStay = computed(() => {
  return props.item.periodOfStay
    ? dayjs(props.item.periodOfStay).format("YYYY/MM/DD")
    : "";
});

const items = computed(() => {
  return [
    { title: "国籍", props: { subtitle: props.item.nationality || "日本" } },
    ...(props.item.isForeigner
      ? [
          { title: "本名", props: { subtitle: props.item.foreignName } },
          {
            title: "在留資格",
            props: { subtitle: props.item.residenceStatus },
          },
          {
            title: "在留期間",
            props: {
              subtitle: props.item.hasPeriodOfStayLimit
                ? formattedPeriodOfStay.value
                : "無制限",
            },
          },
          {
            title: "就労制限",
            props: {
              subtitle: props.item.hasWorkRestrictions ? "あり" : "なし",
            },
          },
        ]
      : []),
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
    "isForeigner", // 外国人かどうか
    "nationality", // 国籍
    "foreignName", // 外国人氏名
    "residenceStatus", // 在留資格
    "hasPeriodOfStayLimit", // 在留期間制限の有無
    "periodOfStay", // 在留期間
    "hasWorkRestrictions", // 就労制限の有無
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
