<script setup>
/**
 * @file components/organisms/ArrangementNotificationStatusUpdater.vue
 * @description A component for updating arrangement notification statuses.
 * @author shisyamo4131
 */
import { ArrangementNotification } from "@/schemas";

/*****************************************************************************
 * OPTIONS & CONSTANTS
 *****************************************************************************/
defineOptions({ inheritAttrs: false });
const includedKeys = ["status"];
const inputProps = { includedKeys };
const dialogProps = { maxWidth: 368 };

/*****************************************************************************
 * REACTIVE OBJECTS
 *****************************************************************************/
const component = useTemplateRef("component");

/*****************************************************************************
 * COMPUTED PROPERTIES
 *****************************************************************************/
const items = computed(() => {
  return ArrangementNotification.STATUS_OPTIONS;
});

/*****************************************************************************
 * EXPOSE
 *****************************************************************************/
defineExpose({
  toCreate: (args) => component.value?.toCreate(args),
  toUpdate: (args) => component.value?.toUpdate(args),
  toDelete: (args) => component.value?.toDelete(args),
});
</script>

<template>
  <air-item-manager
    ref="component"
    v-bind="$attrs"
    :dialog-props="dialogProps"
    :input-props="inputProps"
  >
    <template #input.status="{ attrs }">
      <v-chip-group v-bind="attrs" mandatory column>
        <v-chip
          v-for="item of items"
          :key="item.value"
          :value="item.value"
          :style="{ color: item.color }"
          :disabled="item.disabled"
          filter
          label
        >
          {{ item.title }}
        </v-chip>
      </v-chip-group>
    </template>
    <template #after-status="{ item, updateProperties }">
      <v-expand-transition>
        <v-col v-if="item.isLeaved">
          <v-row>
            <v-col cols="12">
              <air-time-picker-input
                :model-value="item.actualStartTime"
                label="上番時刻"
                required
                @update:model-value="
                  updateProperties({ actualStartTime: $event })
                "
              />
            </v-col>
            <v-col cols="12">
              <MoleculesInputsIsStartNextDay
                :model-value="item.isStartNextDay"
                @update:model-value="
                  updateProperties({ isStartNextDay: $event })
                "
              />
            </v-col>
            <v-col cols="12">
              <air-time-picker-input
                :model-value="item.actualEndTime"
                label="下番時刻"
                required
                @update:model-value="
                  updateProperties({ actualEndTime: $event })
                "
              />
            </v-col>
            <v-col cols="12">
              <air-number-input
                :model-value="item.actualBreakMinutes"
                label="休憩時間"
                control-variant="split"
                suffix="分"
                required
                @update:model-value="
                  updateProperties({ actualBreakMinutes: $event })
                "
              />
            </v-col>
          </v-row>
        </v-col>
      </v-expand-transition>
    </template>
  </air-item-manager>
</template>
