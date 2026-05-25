<script setup>
/*****************************************************************************
 * @file ./components/molecules/ActivatorCard.vue
 * @description An activator card component.
 *
 * @property {String} color - The color of the card and toolbar. Default is "secondary".
 * @property {String} density - The density of the card and toolbar. Default is "compact".
 * @property {Boolean} hideEditBtn - If `true`, the edit button in the toolbar is hidden.
 * @property {String} title - The title displayed on the toolbar.
 *
 * @emits click:edit - Emitted when the edit button is clicked.
 *
 * @slot toolbar-action - A slot for custom toolbar actions. If not provided, a default edit button will be displayed.
 * @slot default - The default slot for the main content of the card.
 *****************************************************************************/
import { useDefaults } from "vuetify";

/*****************************************************************************
 * DEFINE OPTIONS
 *****************************************************************************/
defineOptions({ name: "MoleculesActivatorCard", inheritAttrs: false });

/*****************************************************************************
 * DEFINE PROPS & EMITS
 *****************************************************************************/
const _props = defineProps({
  color: { type: String, default: "secondary" },
  density: { type: String, default: "compact" },
  hideEditBtn: { type: Boolean, default: false },
  title: { type: String, default: undefined },
});
const props = useDefaults(_props, "MoleculesActivatorCard");
const emit = defineEmits(["click:edit"]);

/*****************************************************************************
 * COMPUTED
 *****************************************************************************/
/**
 * Toolbar の属性を返す計算プロパティ
 */
const toolbarAttrs = computed(() => {
  return {
    color: props.color,
    density: props.density,
    title: props.title,
  };
});

/**
 * Toolbar action slot に渡す属性を返す計算プロパティ
 */
const toolbarActionSlotAttrs = computed(() => {
  return {
    onClick: () => emit("click:edit"),
  };
});

const editBtnAttrs = computed(() => {
  return {
    icon: "mdi-pencil",
    size: "small",
    onClick: () => emit("click:edit"),
  };
});
</script>

<template>
  <v-card v-bind="$attrs">
    <!-- TOOLBAR -->
    <v-toolbar v-bind="toolbarAttrs">
      <v-spacer />

      <template v-if="!props.hideEditBtn">
        <slot name="toolbar-action" v-bind="toolbarActionSlotAttrs">
          <v-btn v-bind="editBtnAttrs" />
        </slot>
      </template>
    </v-toolbar>

    <!-- SLOT: DEFAULT -->
    <slot name="default" />
  </v-card>
</template>
