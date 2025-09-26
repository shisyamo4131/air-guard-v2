<script setup>
import { SiteOperationSchedule } from "@/schemas";

/*****************************************************************************
 * DEFINE PROPS
 *****************************************************************************/
const props = defineProps({
  agreement: { type: Object, default: null },
});

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const shiftTypeTitle = computed(() => {
  return (
    SiteOperationSchedule.SHIFT_TYPE[props.agreement?.shiftType]?.title || ""
  );
});
</script>

<template>
  <tr>
    <td>取極め</td>
    <td v-if="!!agreement">
      {{ shiftTypeTitle }}
      {{ `${agreement?.startTime || ""} - ${agreement?.endTime || ""}` }}
      {{ `(実働: ${agreement?.regulationWorkMinutes || 0}分)` }}
      {{ `(休憩: ${agreement?.breakMinutes || 0}分)` }}
    </td>
    <td v-else>
      <v-icon class="mr-1" color="warning" size="small"
        >mdi-alert-circle</v-icon
      >
      <span class="text-warning"
        >取極めが未登録です。先に取極めを登録する必要があります。</span
      >
    </td>
  </tr>
</template>
