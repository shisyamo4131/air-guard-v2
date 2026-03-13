<script setup>
/*****************************************************************************
 * ページネーションコンポーネント
 * @note - 将来、汎用コンポーネントとして昇格する可能性あり。
 *****************************************************************************/
import { useDefaults } from "vuetify";

const _props = defineProps({
  page: { type: Number, default: 1 },
  pageCount: { type: Number, default: 1 },
});

const props = useDefaults(_props, "Pagination");
const emit = defineEmits(["click:prev", "click:next"]);
</script>

<template>
  <div class="d-flex flex-grow-0 align-center justify-center pa-4">
    <v-btn
      :disabled="props.page === 1"
      density="comfortable"
      icon="mdi-arrow-left"
      variant="tonal"
      rounded
      @click="emit('click:prev')"
    ></v-btn>

    <div class="mx-2 text-caption">
      Page {{ props.page }} of {{ props.pageCount }}
    </div>

    <v-btn
      :disabled="props.page >= props.pageCount"
      density="comfortable"
      icon="mdi-arrow-right"
      variant="tonal"
      rounded
      @click="emit('click:next')"
    ></v-btn>
  </div>
</template>
