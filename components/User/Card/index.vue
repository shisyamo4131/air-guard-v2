<script setup>
/*****************************************************************************
 * @file ./components/User/Card/index.vue
 * @description ユーザーカードコンポーネント
 * @author shisyamo4131
 *
 * @property {User} user - 表示するユーザーのデータ
 * @property {boolean} isSelected - カードの選択状態
 * @property {boolean} showDetail - 詳細表示アクションの表示有無
 * @property {boolean} showEdit - 編集アクションの表示有無
 * @property {boolean} showSelect - 選択チェックボックスの表示有無
 *
 * @slots append - 選択チェックボックスを上書きするためのスロット
 *
 * @emits click:select - 選択チェックボックスのクリックイベント（引数にユーザーオブジェクトを渡す）
 * @emits click:edit - 編集アクションのクリックイベント（引数にユーザーオブジェクトを渡す）
 * @emits click:detail - 詳細アクションのクリックイベント（引数にユーザーオブジェクトを渡す）
 *****************************************************************************/
import * as Vue from "vue";
import { User } from "@/schemas";
import { useDefaults } from "vuetify";
import { useRolePresets } from "@/composables/useRolePresets";

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  user: {
    type: Object,
    required: true,
    validator: (value) => value instanceof User,
  },
  loading: { type: Boolean, default: false },
  isSelected: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
});
const props = useDefaults(_props, "UserCard");
const emit = defineEmits(["click:select", "click:edit", "click:detail"]);

/*****************************************************************************
 * SETUP STORES & COMPOSABLES
 *****************************************************************************/
const { ROLE_PRESETS } = useRolePresets();

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Actions（編集・詳細）を表示するかどうかの計算プロパティ
 */
const showActions = Vue.computed(() => {
  return props.showEdit || props.showDetail;
});

/**
 * プリセット役割の選択肢を生成
 * admin と super-user は除外
 */
const roleOptions = computed(() => {
  return Object.entries(ROLE_PRESETS).map(([key, preset]) => ({
    value: key,
    title: preset.label,
    description: preset.description,
    icon: preset.icon,
  }));
});
</script>

<template>
  <v-card>
    <v-card-item :class="{ 'pb-0': showActions }">
      <!-- 将来、アバター画像を表示する予定 -->
      <template #prepend>
        <v-avatar size="40" color="grey-lighten-3" />
      </template>

      <!-- 選択チェックボックス -->
      <template #append>
        <slot name="append">
          <v-icon
            v-if="props.showSelect"
            :color="props.isSelected ? 'primary' : undefined"
            :icon="
              props.isSelected
                ? 'mdi-checkbox-marked'
                : 'mdi-checkbox-blank-outline'
            "
            size="small"
            @click="emit('click:select', props.user)"
          />
        </slot>
      </template>

      <!-- ユーザー名とメールアドレス -->
      <v-card-title>
        <div
          class="text-subtitle-1 text-truncate d-flex align-center"
          style="line-height: 1"
        >
          <span>{{ props.user.displayName }}</span>
          <v-chip
            v-if="props.user.isAdmin"
            label
            size="x-small"
            color="info"
            class="ml-1"
            >管理者</v-chip
          >
          <v-chip
            v-if="props.user.disabled"
            label
            size="x-small"
            color="medium-emphasis"
            class="ml-1"
            >無効</v-chip
          >
        </div>
      </v-card-title>
      <v-card-subtitle class="text-caption">{{
        props.user.email
      }}</v-card-subtitle>
    </v-card-item>

    <!-- <v-card-text class="pt-4">
      <div class="d-flex flex-wrap ga-1">
        <v-chip
          v-for="option in roleOptions"
          :key="option.value"
          :prepend-icon="option.icon"
          variant="flat"
          :color="
            props.user.roles.includes(option.value) ? 'primary' : undefined
          "
          size="x-small"
        >
          {{ option.title }}
          <v-tooltip activator="parent" location="bottom">
            {{ option.description }}
          </v-tooltip>
        </v-chip>
      </div>
    </v-card-text> -->

    <!-- 編集・詳細アクション -->
    <v-card-actions
      :class="{ 'pt-0': showActions, 'justify-end': true }"
      v-if="showActions"
    >
      <v-btn
        v-if="props.showEdit"
        icon="mdi-pencil"
        size="small"
        @click="emit('click:edit', props.user)"
      />
      <v-btn
        v-if="props.showDetail"
        icon="mdi-chevron-right"
        size="small"
        @click="emit('click:detail', props.user)"
      />
    </v-card-actions>
  </v-card>
</template>
