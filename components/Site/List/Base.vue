<script setup>
/*****************************************************************************
 * @file ./components/Site/List/Base.vue
 * @description 現場の基本情報表示コンポーネント
 * @extends AirList
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  code: { type: String, default: "" }, // 現場コード
  name: { type: String, default: "" }, // 現場名
  nameKana: { type: String, default: "" }, // 現場名（カナ）
  zipcode: { type: String, default: "" }, // 郵便番号
  fullAddress: { type: String, default: "" }, // 住所（都道府県、市区町村、町域・番地を結合したもの）
  building: { type: String, default: "" }, // 建物名
});
const props = useDefaults(_props, "SiteListBase");

const items = computed(() => {
  return [
    { title: "現場コード", props: { subtitle: props.code || "-" } },
    { title: "現場名", props: { subtitle: props.name || "-" } },
    {
      title: "現場名（カナ）",
      props: { subtitle: props.nameKana || "-" },
    },
    { title: "郵便番号", props: { subtitle: props.zipcode || "-" } },
    { title: "住所", props: { subtitle: props.fullAddress || "-" } },
    { title: "建物名", props: { subtitle: props.building || "-" } },
  ];
});
</script>

<template>
  <air-list :items="items" />
</template>
