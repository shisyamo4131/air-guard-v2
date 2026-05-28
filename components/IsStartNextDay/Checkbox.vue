<script setup>
/*****************************************************************************
 * @file components/IsStartNextDay/Checkbox.vue
 * @description A component for inputting whether the start time is on the next day.
 *****************************************************************************/
defineOptions({ name: "IsStartNextDayCheckbox", inheritAttrs: false });
</script>

<template>
  <air-checkbox v-bind="$attrs">
    <template #label="{ label }">
      <div class="d-flex align-center">
        {{ label }}
        <v-tooltip location="top">
          <template #activator="{ props: activatorProps }">
            <v-icon
              v-bind="activatorProps"
              class="ml-2"
              color="primary"
              icon="mdi-information"
              size="small"
            />
          </template>
          <template #default>
            <div>
              実際の勤務開始日時が勤務日の翌日になる場合はチェックを入れます。
            </div>
            <div>
              例）勤務日が5月1日、実際の勤務開始日時が5月2日 02:00 の場合
            </div>
          </template>
        </v-tooltip>
      </div>
    </template>
  </air-checkbox>
</template>
