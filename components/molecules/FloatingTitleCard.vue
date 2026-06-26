<script setup>
/*****************************************************************************
 * @file ./components/molecules/FloatingTitleCard.vue
 * @description タイトルが浮かぶカードコンポーネント
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "MoleculesFloatingTitleCard", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "primary" },
  prependIcon: { type: String, default: undefined },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "MoleculesFloatingTitleCard");
</script>

<template>
  <v-card v-bind="$attrs" class="overflow-visible">
    <v-chip
      :color="props.color"
      label
      :prepend-icon="props.prependIcon"
      :text="props.title"
      variant="flat"
      size="x-large"
      style="position: absolute; top: -12px; left: 12px"
    />
    <v-card-text class="pt-10">
      <slot />
    </v-card-text>
  </v-card>
</template>
