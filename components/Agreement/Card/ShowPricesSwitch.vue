<script setup>
/*****************************************************************************
 * AgreementCard 専用 単価情報表示切替スイッチコンポーネント
 *****************************************************************************/
import * as Vue from "vue";

const isExpanded = Vue.inject("isExpanded");
</script>

<template>
  <v-switch
    class="ms-2"
    v-model="isExpanded"
    color="primary"
    density="compact"
    hide-details
  >
    <template #label>
      <span class="text-caption">単価を表示</span>
    </template>
  </v-switch>
</template>
