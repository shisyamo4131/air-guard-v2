<script setup>
/**
 * @file @/components/organisms/SiteOperationScheduleManager.vue
 * @description A component that manages the site operation schedule.
 * @author shisyamo4131
 */
</script>

<template>
  <air-array-manager>
    <template #input.shiftType="{ attrs }">
      <v-radio-group v-bind="attrs" inline>
        <v-radio label="日勤" value="DAY" />
        <v-radio label="夜勤" value="NIGHT" />
      </v-radio-group>
    </template>
    <template #input.isStartNextDay="{ attrs }">
      <MoleculesInputsIsStartNextDay v-bind="attrs" />
    </template>
    <template v-for="(slotFn, slotName) in $slots" #[slotName]="scope">
      <slot :name="slotName" v-bind="scope ?? {}" />
    </template>
  </air-array-manager>
</template>
