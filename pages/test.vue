<script setup>
const model = defineModel();
</script>

<template>
  <v-container>
    <v-locale-provider locale="ja">
      <v-date-input v-model="model" placeholder="日付を選択" />
    </v-locale-provider>
    {{ model }}
  </v-container>
</template>
