<script setup>
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  schedule: { type: Object, default: null },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const shiftTypeTitle = computed(() => {
  return (
    SiteOperationSchedule.SHIFT_TYPE[props.schedule?.shiftType]?.title || ""
  );
});
</script>

<template>
  <tr>
    <td>当日時間</td>
    <td>
      {{ shiftTypeTitle }}
      {{ `${schedule?.startTime || ""} - ${schedule?.endTime || ""}` }}
    </td>
  </tr>
</template>
