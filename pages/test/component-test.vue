<script setup>
import { TAG_SIZE_OPTIONS } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useAuthStore } from "@/stores/useAuthStore";

const auth = useAuthStore();
</script>

<template>
  <TemplatesFixedHeightContainer>
    <v-card>
      <template #title>タグサイズ変更テスト</template>
      <template #text>
        <v-select
          :model-value="auth.tagSize"
          :items="TAG_SIZE_OPTIONS"
          label="タグサイズ"
          @update:model-value="auth.tagSize = $event"
        />
        {{ `auth.tagSize: ${auth.tagSize}` }}
      </template>
    </v-card>
  </TemplatesFixedHeightContainer>
</template>
