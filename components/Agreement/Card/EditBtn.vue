<script setup>
/*****************************************************************************
 * AgreementCard 専用 編集ボタンコンポーネント
 *****************************************************************************/
import * as Vue from "vue";

const emit = Vue.inject("emit");
</script>

<template>
  <AtomsBtnsEdit
    density="compact"
    icon
    size="small"
    @click="emit('click:edit')"
  />
</template>
