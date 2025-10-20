<script setup>
/*****************************************************************************
 * @file components/molecules/inputs/isStartNextDay.vue
 * @description A component for inputting whether the start time is on the next day.
 *****************************************************************************/
const model = defineModel({ type: Boolean, default: false });
</script>

<template>
  <v-card border flat>
    <v-card-text class="pt-0">
      <v-checkbox class="mr-4" v-model="model" label="翌日開始" hide-details />
      <div class="text-caption text-medium-emphasis">
        <div>
          実際の勤務開始日時が勤務日の翌日になる場合はチェックを入れます。
        </div>
        例）勤務日が5月1日、実際の勤務開始日時が5月2日 02:00 の場合
      </div>
    </v-card-text>
  </v-card>
</template>
