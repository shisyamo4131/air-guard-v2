<script setup>
import dayjs from "dayjs";
import ja from "dayjs/locale/ja";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  dateAt: { type: Object, default: undefined },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const dateStr = computed(() => {
  if (!props.dateAt) return "";
  return dayjs(props.dateAt).locale(ja).format("YYYY年MM月DD日(ddd)");
});
</script>

<template>
  <tr>
    <td>日付</td>
    <td>{{ dateStr }}</td>
  </tr>
</template>
