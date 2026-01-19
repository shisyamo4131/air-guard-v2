<script setup>
/*****************************************************************************
 * 現場稼働予定選択用コンポーネント
 *
 * @emit click:close 閉じるボタンがクリックされたときに発火します。
 * @emit click:edit 現場稼働予定の編集ボタンがクリックされたときに発火します。
 * @emit click:create 現場稼働予定の新規作成ボタンがクリックされたときに発火します。
 *
 * @slots title タイトルスロット
 * @slots subtitle サブタイトルスロット
 *****************************************************************************/
import { useDefaults } from "vuetify";
import { SHIFT_TYPE_VALUES } from "@shisyamo4131/air-guard-v2-schemas/constants";
import { useIndex } from "./useIndex";

/**
 * SETUP PROPS
 */
const _props = defineProps({
  fetchSiteComposable: { type: Object, default: undefined },
  dateAt: { type: Object, default: () => new Date() },
  shiftType: { type: String, default: SHIFT_TYPE_VALUES.DAY.value },
  siteId: { type: [String, null], default: null },
  schedules: { type: Array, default: () => [] },
});
const props = useDefaults(_props, "SiteOperationScheduleSelector");

/**
 * SETUP EMITS
 */
const emit = defineEmits(["click:close", "click:edit", "click:create"]);

/**
 * SETUP COMPOSABLES
 */
const { title, subtitle, handleClickCreate, handleClickEdit } = useIndex(
  props,
  emit,
);
</script>

<template>
  <v-card>
    <!-- prepend -->
    <template #prepend>
      <AtomsChipsShiftType :shift-type="props.shiftType" />
    </template>

    <!-- title -->
    <template #title>
      <slot name="title" v-bind="{ title }">
        <span>{{ title }}</span>
      </slot>
    </template>

    <!-- subtitle -->
    <template #subtitle>
      <slot name="subtitle">{{ subtitle }}</slot>
    </template>

    <!-- append -->
    <template #append>
      <v-icon icon="mdi-close" @click="emit('click:close')" />
    </template>

    <!-- text -->
    <template #text>
      <v-list v-if="props.schedules.length > 0" class="py-0" border>
        <template v-for="(schedule, index) in props.schedules" :key="index">
          <SiteOperationScheduleListItem :model-value="schedule">
            <template #append>
              <v-list-item-action>
                <v-btn icon="mdi-pencil" @click="handleClickEdit(schedule)" />
              </v-list-item-action>
            </template>
          </SiteOperationScheduleListItem>
          <v-divider v-if="index < props.schedules.length - 1" />
        </template>
      </v-list>
      <v-empty-state
        v-else
        icon="mdi-alert-circle-outline"
        title="現場稼働予定は登録されていません"
      />
    </template>

    <!-- actions -->
    <template #actions>
      <div class="d-flex justify-end">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          text="新規作成"
          @click="handleClickCreate"
        />
      </div>
    </template>
  </v-card>
</template>
