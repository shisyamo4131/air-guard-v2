<script setup>
import { ref } from "vue";

const single = ref();
const multiple = ref([]);
</script>

<template>
  <v-container class="pa-4" style="max-width: 600px">
    <!-- 単一選択：必須 -->
    <air-select
      v-model="single"
      label="必須（単一選択）"
      :items="[
        { title: '選択肢A', value: 'A' },
        { title: '選択肢B', value: 'B' },
        { title: '選択肢C', value: 'C' },
      ]"
      required
    >
      <template #append>
        <v-icon>mdi-magnify</v-icon>
      </template>
    </air-select>
    <p class="text-caption mb-6">選択中: {{ single }}</p>

    <!-- 複数選択：最小2・最大3件選択 -->
    <air-select
      v-model="multiple"
      label="複数選択（2〜3件）"
      multiple
      :items="[
        { title: 'オプション1', value: '1' },
        { title: 'オプション2', value: '2' },
        { title: 'オプション3', value: '3' },
        { title: 'オプション4', value: '4' },
      ]"
      :min-items="2"
      :max-items="3"
      required
    />
    <p class="text-caption">選択中: {{ multiple }}</p>
  </v-container>
</template>
