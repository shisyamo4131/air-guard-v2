<script setup>
/*****************************************************************************
 * @file ./components/Employee/Activator/Base.vue
 * @description 従業員の基本情報表示コンポーネント
 * - `EmployeeManager` の activator スロット用コンポーネント
 *****************************************************************************/
import dayjs from "dayjs";
import { Employee } from "@/schemas";
import { useDefaults } from "vuetify";
import { useConstants } from "@/composables/useConstants";

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
const props = useDefaults(_props, "EmployeeActivatorBase");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * SETUP COMPOSABLES
 *****************************************************************************/
const { GENDER } = useConstants();

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const formattedDateOfBirth = computed(() => {
  return props.item.dateOfBirth
    ? dayjs(props.item.dateOfBirth).format("YYYY/MM/DD")
    : "";
});
const formattedDateOfHire = computed(() => {
  return props.item.dateOfHire
    ? dayjs(props.item.dateOfHire).format("YYYY/MM/DD")
    : "";
});

const items = computed(() => {
  return [
    { title: "従業員コード", props: { subtitle: props.item.code || "-" } },
    { title: "従業員名", props: { subtitle: props.item.fullName || "-" } },
    {
      title: "従業員名（カナ）",
      props: { subtitle: props.item.fullNameKana || "-" },
    },
    {
      title: "性別",
      props: { subtitle: GENDER.value[props.item.gender]?.title || "-" },
    },
    {
      title: "生年月日",
      props: { subtitle: formattedDateOfBirth.value || "-" },
    },
    { title: "入社日", props: { subtitle: formattedDateOfHire.value || "-" } },
    { title: "肩書", props: { subtitle: props.item.title || "-" } },
    { title: "郵便番号", props: { subtitle: props.item.zipcode || "-" } },
    { title: "住所", props: { subtitle: props.item.fullAddress || "-" } },
    { title: "建物名", props: { subtitle: props.item.building || "-" } },
    { title: "携帯電話番号", props: { subtitle: props.item.mobile || "-" } },
    { title: "メールアドレス", props: { subtitle: props.item.email || "-" } },
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
    "code",
    "lastName",
    "firstName",
    "lastNameKana",
    "firstNameKana",
    "displayName",
    "displayNameKana",
    "gender",
    "dateOfBirth",
    "dateOfHire",
    "title",
    "zipcode",
    "prefCode",
    "city",
    "building",
    "mobile",
    "email",
    "remarks",
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
