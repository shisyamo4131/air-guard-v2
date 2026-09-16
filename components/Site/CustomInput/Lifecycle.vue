<script setup>
import { computed } from "vue";
const props = defineProps({
  disabled: { type: Boolean, default: false },
  item: { type: Object, required: true },
});

const isReactivation = computed(
  () => props.item._beforeData?.status === "TERMINATED" && props.item.status === "ACTIVE",
);
</script>

<template>
  <v-row dense>
    <v-col v-if="!isReactivation" cols="12">
      <v-alert type="warning" variant="tonal">
        終了後の未実績予定がない現場だけ終了できます。終了後も単発の残工事は選択できます。
      </v-alert>
    </v-col>
    <v-col v-else cols="12">
      <v-alert type="info" variant="tonal">
        現在の取引先を維持したまま再有効化します。新しい工期と理由を入力してください。
      </v-alert>
    </v-col>
    <v-col v-if="props.item.status === 'ACTIVE'" cols="12" md="6">
      <air-date-input
        v-model="props.item.constructionPeriodStartAt"
        label="新しい工期開始日"
        :disabled="props.disabled"
      />
    </v-col>
    <v-col v-if="props.item.status === 'ACTIVE'" cols="12" md="6">
      <air-date-input
        v-model="props.item.constructionPeriodEndAt"
        label="新しい工期終了日"
        :disabled="props.disabled"
      />
    </v-col>
    <v-col cols="12">
      <air-textarea
        v-model="props.item.statusChangeReason"
        label="状態変更理由"
        maxlength="200"
        counter
        :disabled="props.disabled"
      />
    </v-col>
  </v-row>
</template>
