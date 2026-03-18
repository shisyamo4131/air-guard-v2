<script setup>
/*****************************************************************************
 * @file ./components/Employee/Card/index.vue
 * @description 従業員カードコンポーネント
 * @author shisyamo4131
 *
 * @property {Employee} employee - 表示する従業員のデータ
 * @property {boolean} isSelected - カードの選択状態（双方向バインディング）
 * @property {boolean} showDetail - 詳細表示アクションの表示有無
 * @property {boolean} showEdit - 編集アクションの表示有無
 * @property {boolean} showSelect - 選択チェックボックスの表示有無
 *
 * @emits update:isSelected - isSelected の更新イベント（双方向バインディング用）
 * @emits click:edit - 編集アクションのクリックイベント
 * @emits click:detail - 詳細アクションのクリックイベント
 *****************************************************************************/
import * as Vue from "vue";
import { Employee } from "@/schemas";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  employee: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Employee,
  },
  isSelected: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
});
const props = useDefaults(_props, "EmployeeCard");
const emit = defineEmits(["update:isSelected", "click:edit", "click:detail"]);

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
const internalIsSelected = ref(false);
Vue.watch(
  () => props.isSelected,
  (newVal) => (internalIsSelected.value = newVal),
  { immediate: true },
);

/**
 * isSelected の双方向バインディング用の計算プロパティ
 * - get: internalIsSelected を返す
 * - set: internalIsSelected を更新し、update:isSelected イベントを発火する
 */
const bindedIsSelected = Vue.computed({
  get() {
    return internalIsSelected.value;
  },
  set(newVal) {
    internalIsSelected.value = newVal;
    emit("update:isSelected", newVal);
  },
});

/**
 * Actions（編集・詳細）を表示するかどうかの計算プロパティ
 */
const showActions = Vue.computed(() => {
  return props.showEdit || props.showDetail;
});
</script>

<template>
  <v-card>
    <v-card-item :class="{ 'pb-0': showActions }">
      <!-- 将来、アバター画像を表示する予定 -->
      <template #prepend>
        <v-skeleton-loader type="avatar" />
      </template>

      <!-- 選択チェックボックス -->
      <template #append>
        <v-checkbox
          v-if="props.showSelect"
          v-model="bindedIsSelected"
          hide-details
        />
      </template>

      <!-- 社員コードと氏名 -->
      <v-card-title>
        <div class="text-caption text-medium-emphasis text-truncate">
          {{ `No. ${props.employee.code || "---"}` }}
        </div>
        <div class="text-subtitle-1 text-truncate" style="line-height: 1">
          {{ props.employee.fullName }}
        </div>
      </v-card-title>
      <v-card-subtitle class="text-caption">{{
        props.employee.fullNameKana
      }}</v-card-subtitle>
    </v-card-item>

    <!-- 編集・詳細アクション -->
    <v-card-actions
      :class="{ 'pt-0': showActions, 'justify-end': true }"
      v-if="showActions"
    >
      <v-btn
        v-if="props.showEdit"
        icon="mdi-pencil"
        size="small"
        @click="emit('click:edit', props.employee)"
      />
      <v-btn
        v-if="props.showDetail"
        icon="mdi-chevron-right"
        size="small"
        @click="emit('click:detail', props.employee)"
      />
    </v-card-actions>
  </v-card>
</template>
