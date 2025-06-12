<script setup>
import { ref, watch } from "vue";

// VCalendar の modelValue (v-model) は配列を期待するため、
// 初期表示したい月の日付を要素とする配列で初期化します。
const currentDate = ref([new Date(2025, 0, 1)]);

function handleNext(event) {
  console.log("VCalendar click:next event:", event);
}

function handleDayClick(event) {
  console.log("VCalendar click:day event:", event);
}

watch(currentDate, (newDateArray) => {
  console.log("VCalendar v-model (currentDate) changed:", newDateArray);
  // VCalendar が v-model を配列として更新するため、
  // 配列の最初の要素を使って表示されている月を判断できます。
  if (newDateArray && newDateArray.length > 0) {
    const currentDisplayMonthIndicator = newDateArray[0];
    // currentDisplayMonthIndicator (Date オブジェクト) に基づいて Firestore からデータを取得できます。
  }
});
</script>

<template>
  <v-container>
    <p>VCalendar イベントテスト中。ブラウザのコンソールを確認してください。</p>
    <v-calendar
      v-model="currentDate"
      type="month"
      @click:next="handleNext"
      @click:day="handleDayClick"
    ></v-calendar>
  </v-container>
</template>
