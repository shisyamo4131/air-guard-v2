<script setup>
/*****************************************************************************
 * @file ./components/Site/Card/index.vue
 * @description 現場カードコンポーネント
 * @author shisyamo4131
 *
 * @property {Site} site - 表示する現場のデータ
 * @property {boolean} isSelected - カードの選択状態
 * @property {boolean} showDetail - 詳細表示アクションの表示有無
 * @property {boolean} showEdit - 編集アクションの表示有無
 * @property {boolean} showSelect - 選択チェックボックスの表示有無
 *
 * @emits click:select - 選択チェックボックスのクリックイベント
 * @emits click:edit - 編集アクションのクリックイベント
 * @emits click:detail - 詳細アクションのクリックイベント
 *****************************************************************************/
import * as Vue from "vue";
import { Site } from "@/schemas";
import { useDefaults } from "vuetify";

/*****************************************************************************
 * SETUP PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  site: {
    type: Object,
    required: true,
    validator: (value) => value instanceof Site,
  },
  isSelected: { type: Boolean, default: false },
  showDetail: { type: Boolean, default: false },
  showEdit: { type: Boolean, default: false },
  showSelect: { type: Boolean, default: false },
});
const props = useDefaults(_props, "SiteCard");
const emit = defineEmits(["click:select", "click:edit", "click:detail"]);

/*****************************************************************************
 * SETUP STATES
 *****************************************************************************/
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
        <v-avatar size="40" color="grey-lighten-3" />
      </template>

      <!-- 選択チェックボックス -->
      <template #append>
        <v-icon
          v-if="props.showSelect"
          :color="props.isSelected ? 'primary' : undefined"
          size="small"
          @click="emit('click:select')"
        >
          {{
            props.isSelected
              ? "mdi-checkbox-marked"
              : "mdi-checkbox-blank-outline"
          }}
        </v-icon>
      </template>

      <!-- 現場コードと名称 -->
      <v-card-title>
        <div class="text-caption text-medium-emphasis text-truncate">
          {{ `No. ${props.site.code || "---"}` }}
        </div>
        <div class="text-subtitle-1 text-truncate" style="line-height: 1">
          {{ props.site.name }}
        </div>
      </v-card-title>
      <v-card-subtitle class="text-caption">{{
        props.site.nameKana
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
        @click="emit('click:edit', props.site)"
      />
      <v-btn
        v-if="props.showDetail"
        icon="mdi-chevron-right"
        size="small"
        @click="emit('click:detail', props.site)"
      />
    </v-card-actions>
  </v-card>
</template>
