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
 * DEFINE PROPS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "primary" },
  prependIcon: { type: String, default: undefined },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "MoleculesFloatingTitleCard");

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
const slots = useSlots();
const filteredSlots = computed(() =>
  Object.fromEntries(
    Object.entries(slots).filter(
      ([name]) => name !== "title" && name !== "prepend",
    ),
  ),
);
</script>

<template>
  <div style="position: relative">
    <v-card v-bind="$attrs" class="pt-8">
      <template v-for="(_, slotName) in filteredSlots" #[slotName]="scope">
        <slot :name="slotName" v-bind="scope ?? {}"></slot>
      </template>
    </v-card>
    <v-chip
      :color="props.color"
      label
      :prepend-icon="props.prependIcon"
      :text="props.title"
      variant="flat"
      size="x-large"
      style="position: absolute; top: -12px; left: 12px"
    />
  </div>
</template>
