<script setup>
/*****************************************************************************
 * @file ./components/Employee/Activator/SecurityGuard.vue
 * @description 従業員の警備員資格情報表示コンポーネント
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
const props = useDefaults(_props, "EmployeeActivatorSecurityGuard");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedDateOfSecurityGuardRegistration = computed(() => {
  return props.item.dateOfSecurityGuardRegistration
    ? dayjs(props.item.dateOfSecurityGuardRegistration).format("YYYY年MM月DD日")
    : "";
});

const formattedEmergencyContactName = computed(() => {
  const name = props.item.emergencyContactName || "N/A";
  const relation = props.item.emergencyContactRelationDetail || "N/A";
  return `${name} (${relation})`;
});

const items = computed(() => {
  return [
    {
      title: "警備員登録日",
      props: { subtitle: formattedDateOfSecurityGuardRegistration.value },
    },
    { title: "血液型", props: { subtitle: props.item.bloodType || "N/A" } },
    {
      title: "緊急連絡先氏名",
      props: { subtitle: formattedEmergencyContactName.value },
    },
    {
      title: "緊急連絡先住所",
      props: { subtitle: props.item.emergencyContactAddress || "N/A" },
    },
    {
      title: "緊急連絡先電話番号",
      props: { subtitle: props.item.emergencyContactPhone || "N/A" },
    },
    { title: "本籍地", props: { subtitle: props.item.domicile || "N/A" } },
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
    "hasSecurityGuardRegistration", // 警備員資格登録の有無
    "dateOfSecurityGuardRegistration", // 警備員資格登録日
    "bloodType", // 血液型
    "emergencyContactName", // 緊急連絡先氏名
    "emergencyContactRelation", // 緊急連絡先との関係
    "emergencyContactRelationDetail", // 緊急連絡先との関係詳細
    "emergencyContactAddress", // 緊急連絡先住所
    "emergencyContactPhone", // 緊急連絡先電話番号
    "domicile", // 本籍地
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
