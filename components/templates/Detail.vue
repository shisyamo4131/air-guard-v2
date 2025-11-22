<script setup>
import { useRouter } from "vue-router";

const props = defineProps({
  fixed: { type: Boolean, default: false },
  height: {
    type: [String, Number],
    default: "calc(100vh - var(--app-bar-height) - var(--footer-height))",
  },
  hidePrepend: { type: Boolean, default: false },
  hideToolbar: { type: Boolean, default: false },
  label: { type: String, default: undefined },
  prependAction: { type: Function, default: undefined },
  prependIcon: { type: String, default: "mdi-chevron-left" },
});

const router = useRouter();

function onClickPrepend() {
  props.prependAction ? props.prependAction() : router.go(-1);
}
</script>

<template>
  <TemplatesBase
    :fixed="fixed"
    :height="height"
    :hide-toolbar="hideToolbar"
    :label="label"
  >
    <template #prepend-toolbar>
      <v-btn v-if="!hidePrepend" :icon="prependIcon" @click="onClickPrepend" />
    </template>

    <template #append-toolbar>
      <slot name="append-toolbar" />
    </template>

    <template #default>
      <slot name="default" />
    </template>
  </TemplatesBase>
</template>
